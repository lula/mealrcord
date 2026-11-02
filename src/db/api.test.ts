import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/test/fake-tauri-db";

let fake = createFakeDb();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, args: unknown) => fake.invoke(cmd, args) }));
// Hooks import sonner/react-query; only the plain async functions are used here.
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

const { saveRecipe, getRecipe, mealsUsingRecipe } = await import("@/features/recipes/api");
const { createIngredient } = await import("@/features/ingredients/api");
const { saveMeal, duplicateMeal, plannedUsageCount } = await import("@/features/meals/api");
const { db } = await import("./client");
const { mealRecipes, plannedMeals } = await import("./schema");
const { aggregate } = await import("@/lib/units");
const plannerApi = await import("@/features/planner/api");

beforeEach(() => {
  fake = createFakeDb();
});

async function seed() {
  const flour = await createIngredient({ name: "Farina", defaultUnitId: "unit-g" });
  const eggs = await createIngredient({ name: "Uova" });
  const pasta = await saveRecipe({
    name: "Tagliatelle",
    description: "",
    baseServings: 4,
    ingredients: [
      { ingredientId: flour, quantity: 400, unitId: "unit-g" },
      { ingredientId: eggs, quantity: 4, unitId: "unit-pcs" },
    ],
    steps: ["Impastare farina e uova", "  ", "Stendere e tagliare"],
    tagIds: ["tag-first"],
  });
  const cake = await saveRecipe({
    name: "Torta",
    description: "",
    baseServings: 8,
    ingredients: [{ ingredientId: flour, quantity: 0.3, unitId: "unit-kg" }],
    steps: [],
    tagIds: ["tag-dessert"],
  });
  const meal = await saveMeal({
    name: "Menu del giorno",
    notes: "",
    courses: { starter: [], first: [pasta], main: [], dessert: [cake] },
  });
  return { flour, eggs, pasta, cake, meal };
}

describe("guests per recipe", () => {
  it("splits the guests evenly among recipes without an override", () => {
    expect(plannerApi.courseGuests(20, ["a", "b", "c"], {})).toEqual({ a: 7, b: 7, c: 6 });
    expect(plannerApi.courseGuests(20, ["a"], {})).toEqual({ a: 20 });
  });
  it("gives the others what is left after overrides", () => {
    expect(plannerApi.courseGuests(20, ["a", "b"], { a: 15 })).toEqual({ a: 15, b: 5 });
    expect(plannerApi.courseGuests(20, ["a", "b"], { a: 15, b: 8 })).toEqual({ a: 15, b: 8 });
    expect(plannerApi.courseGuests(20, ["a", "b"], { a: 25 })).toEqual({ a: 25, b: 0 });
  });
  it("warns only above the threshold", () => {
    expect(plannerApi.exceedsGuests(23, 20, 20)).toBe(false);
    expect(plannerApi.exceedsGuests(25, 20, 20)).toBe(true);
    expect(plannerApi.exceedsGuests(21, 20, 0)).toBe(true);
  });
});

describe("settings", () => {
  it("returns defaults and saves values", async () => {
    const { getSettings, saveSetting } = await import("@/features/settings/api");
    expect((await getSettings()).guestsWarningPercent).toBe(20);
    await saveSetting("guestsWarningPercent", 35);
    await saveSetting("guestsWarningPercent", 40);
    expect((await getSettings()).guestsWarningPercent).toBe(40);
  });
});

describe("data layer", () => {
  it("saves and reloads a recipe with ordered ingredients and tags", async () => {
    const { pasta } = await seed();
    const r = await getRecipe(pasta);
    expect(r?.name).toBe("Tagliatelle");
    expect(r?.ingredients.map((i) => i.ingredient.name)).toEqual(["Farina", "Uova"]);
    expect(r?.ingredients[0].unit.symbol).toBe("g");
    expect(r?.tags.map((t) => t.tag.name)).toEqual(["Primo"]);
    expect(r?.steps.map((st) => st.text)).toEqual(["Impastare farina e uova", "Stendere e tagliare"]);
  });

  it("replaces ingredients on update", async () => {
    const { pasta, flour } = await seed();
    await saveRecipe({ id: pasta, name: "Tagliatelle", description: "x", baseServings: 2, ingredients: [{ ingredientId: flour, quantity: 200, unitId: "unit-g" }], steps: ["Cuocere"], tagIds: [] });
    const r = await getRecipe(pasta);
    expect(r?.baseServings).toBe(2);
    expect(r?.ingredients).toHaveLength(1);
    expect(r?.tags).toHaveLength(0);
    expect(r?.steps.map((st) => st.text)).toEqual(["Cuocere"]);
  });

  it("rolls back a failed batch", async () => {
    const { pasta } = await seed();
    await expect(
      saveRecipe({ id: pasta, name: "Rotto", description: "", baseServings: 4, ingredients: [{ ingredientId: "missing", quantity: 1, unitId: "unit-g" }], steps: [], tagIds: [] }),
    ).rejects.toThrow();
    expect((await getRecipe(pasta))?.name).toBe("Tagliatelle");
  });

  it("rejects a meal with no recipes or a repeated recipe", async () => {
    const { pasta, meal } = await seed();
    await expect(saveMeal({ name: "Vuoto", notes: "", courses: { starter: [], first: [], main: [], dessert: [] } })).rejects.toThrow(/almeno una ricetta/);
    await expect(saveMeal({ name: "Doppio", notes: "", courses: { starter: [], first: [pasta], main: [pasta], dessert: [] } })).rejects.toThrow(/una sola volta/);
    // The database enforces it too.
    await expect(db.batch([db.insert(mealRecipes).values({ mealId: meal, recipeId: pasta, course: "main" })])).rejects.toThrow(/UNIQUE/);
  });

  it("duplicates a menu with its recipes per course", async () => {
    const { meal, pasta, cake } = await seed();
    const copy = await duplicateMeal(meal);
    const m = await db.query.meals.findFirst({ where: (t, { eq }) => eq(t.id, copy), with: { recipes: true } });
    expect(m?.name).toBe("Menu del giorno (copia)");
    expect(m?.recipes.map((r) => [r.course, r.recipeId]).sort()).toEqual([["dessert", cake], ["first", pasta]]);
  });

  it("moves and copies a planned meal with its per-course and per-recipe values", async () => {
    const { meal, pasta } = await seed();
    const id = await plannerApi.savePlanned({
      mealId: meal,
      date: "2026-11-02",
      slot: "Cena",
      guests: 30,
      coefficient: 0.8,
      courseCoefficients: { dessert: 0.5 },
      recipeGuests: { [pasta]: 12 },
      notes: "<p>nota</p>",
    });
    await plannerApi.movePlanned({ id, date: "2026-11-04" });
    const copyId = await plannerApi.copyPlanned({ id, date: "2026-11-05" });

    const entries = await plannerApi.fetchPlanned("2026-11-01", "2026-11-30");
    expect(entries.map((e) => [e.id, e.date])).toEqual([
      [id, "2026-11-04"],
      [copyId, "2026-11-05"],
    ]);
    const copy = entries[1];
    expect([copy.slot, copy.guests, copy.coefficient, copy.notes]).toEqual(["Cena", 30, 0.8, "<p>nota</p>"]);
    expect(copy.courseCoefficients.map((c) => [c.course, c.coefficient])).toEqual([["dessert", 0.5]]);
    expect(copy.recipeGuests.map((g) => [g.recipeId, g.guests])).toEqual([[pasta, 12]]);
  });

  it("plans a menu at most once per day", async () => {
    const { meal } = await seed();
    const base = { mealId: meal, guests: 10, coefficient: 1, notes: "" };
    const lunch = await plannerApi.savePlanned({ ...base, date: "2026-11-02", slot: "Pranzo" });
    const other = await plannerApi.savePlanned({ ...base, date: "2026-11-03", slot: "Pranzo" });

    await expect(plannerApi.savePlanned({ ...base, date: "2026-11-02", slot: "Cena" })).rejects.toThrow(/già pianificato/);
    await expect(plannerApi.movePlanned({ id: other, date: "2026-11-02" })).rejects.toThrow(/già pianificato/);
    await expect(plannerApi.copyPlanned({ id: lunch, date: "2026-11-02" })).rejects.toThrow(/già pianificato/);
    // Editing the same planned meal on its own day is fine.
    await plannerApi.savePlanned({ ...base, id: lunch, date: "2026-11-02", slot: "Cena" });
    // The database enforces it too.
    await expect(db.batch([db.insert(plannedMeals).values({ id: "x", date: "2026-11-03", slot: "Cena", mealId: meal, guests: 5 })])).rejects.toThrow(/UNIQUE/);
  });

  it("plans a menu on several days at once, or on none if one is taken", async () => {
    const { meal, pasta } = await seed();
    const base = { mealId: meal, slot: "Pranzo", guests: 10, coefficient: 0.9, notes: "", recipeGuests: { [pasta]: 6 } };
    const ids = await plannerApi.savePlannedOnDays({ ...base, dates: ["2026-11-02", "2026-11-04"] });
    expect(ids).toHaveLength(2);
    const entries = await plannerApi.fetchPlanned("2026-11-02", "2026-11-08");
    expect(entries.map((e) => [e.date, e.coefficient, e.recipeGuests[0]?.guests])).toEqual([
      ["2026-11-02", 0.9, 6],
      ["2026-11-04", 0.9, 6],
    ]);
    // 11-04 is taken: nothing is saved, not even 11-05.
    await expect(plannerApi.savePlannedOnDays({ ...base, dates: ["2026-11-05", "2026-11-04"] })).rejects.toThrow(/già pianificato/);
    expect(await plannerApi.fetchPlanned("2026-11-05", "2026-11-05")).toEqual([]);
  });

  it("handles piatti unici: limits, menus, scaling in the planner and copies", async () => {
    const { pasta, cake, flour } = await seed();
    const { saveDish } = await import("@/features/dishes/api");
    const { saveSetting } = await import("@/features/settings/api");

    // At most N recipes (default 3), at least one.
    await expect(saveDish({ name: "Vuoto", notes: "", recipes: [] })).rejects.toThrow(/almeno una ricetta/);
    await saveSetting("maxDishRecipes", 1);
    await expect(
      saveDish({ name: "Troppe", notes: "", recipes: [{ recipeId: pasta, coefficient: 1 }, { recipeId: cake, coefficient: 1 }] }),
    ).rejects.toThrow(/al massimo 1/);
    await saveSetting("maxDishRecipes", 3);

    // Bowl: tagliatelle at half portion, torta at full.
    const bowl = await saveDish({ name: "Bowl", notes: "", recipes: [{ recipeId: pasta, coefficient: 0.5 }, { recipeId: cake, coefficient: 1 }] });
    const menu = await saveMeal({ name: "Solo bowl", notes: "", courses: { starter: [], first: [], main: [], dessert: [] }, dishIds: [bowl] });

    // 40 guests, dish coefficient 0.8 (planned coefficient 1).
    const id = await plannerApi.savePlanned({ mealId: menu, date: "2026-11-02", slot: "Pranzo", guests: 40, coefficient: 1, dishCoefficient: 0.8, notes: "" });
    const [entry] = await plannerApi.fetchPlanned("2026-11-02", "2026-11-02");
    const scaled = plannerApi.scalePlannedDishes(entry)!;
    expect(scaled.coefficient).toBe(0.8);
    expect(scaled.dishes[0].guests).toBe(40);
    // Tagliatelle: 40 / 4 * 0.8 * 0.5 = x4 -> 1600 g flour; Torta: 40 / 8 * 0.8 = x4 -> 1.2 kg flour.
    expect(scaled.dishes[0].recipes.map((r) => +r.factor.toFixed(3))).toEqual([4, 4]);
    const flourLine = aggregate(plannerApi.plannedLines(entry)).find((l) => l.ingredientId === flour)!;
    expect([+flourLine.quantity.toFixed(3), flourLine.unit.symbol]).toEqual([2.8, "kg"]);

    // Per-dish guests and copies keep them.
    await plannerApi.savePlanned({ id, mealId: menu, date: "2026-11-02", slot: "Pranzo", guests: 40, coefficient: 1, dishCoefficient: 0.8, dishGuests: { [bowl]: 10 }, notes: "" });
    const copyId = await plannerApi.copyPlanned({ id, date: "2026-11-03" });
    const [copy] = await plannerApi.fetchPlanned("2026-11-03", "2026-11-03");
    expect([copy.id, copy.dishCoefficient, copy.dishGuests.map((g) => g.guests)]).toEqual([copyId, 0.8, [10]]);

    // A recipe used by a dish is reported (its deletion is blocked).
    const { dishesUsingRecipe } = await import("@/features/recipes/api");
    expect(await dishesUsingRecipe(cake)).toEqual(["Bowl"]);
  });

  it("removes a menu from every plan, keeping the menu", async () => {
    const { meal, pasta } = await seed();
    const { removeFromPlanner } = await import("@/features/meals/api");
    const base = { mealId: meal, slot: "Pranzo", guests: 10, coefficient: 1, notes: "", recipeGuests: { [pasta]: 4 }, courseCoefficients: { first: 0.5 } };
    await plannerApi.savePlannedOnDays({ ...base, dates: ["2026-10-01", "2026-11-02"] });
    await removeFromPlanner(meal);
    expect(await plannerApi.fetchPlannedForMeal(meal)).toEqual([]);
    expect(await plannedUsageCount(meal)).toBe(0);
    // Overrides went with them, and the menu is still there.
    const { plannedMealRecipeGuests, plannedMealCourseCoefficients, meals } = await import("./schema");
    expect(await db.select().from(plannedMealRecipeGuests)).toEqual([]);
    expect(await db.select().from(plannedMealCourseCoefficients)).toEqual([]);
    expect((await db.select().from(meals)).map((m) => m.id)).toContain(meal);
  });

  it("reports where recipes and meals are used", async () => {
    const { pasta, meal } = await seed();
    expect(await mealsUsingRecipe(pasta)).toEqual(["Menu del giorno"]);
    await db.insert(plannedMeals).values({ id: "p1", date: "2026-11-02", slot: "Pranzo", mealId: meal, guests: 40 }).run();
    expect(await plannedUsageCount(meal)).toBe(1);
    // A planned menu can no longer be edited.
    await expect(saveMeal({ id: meal, name: "Cambiato", notes: "", courses: { starter: [], first: [pasta], main: [], dessert: [] } })).rejects.toThrow(/non si può più modificare/);
  });

  it("scales planned meals to guests and builds the shopping list", async () => {
    const { meal, pasta } = await seed();
    // Dessert overrides the planned coefficient (0.8) with its own (0.5).
    const plan = { mealId: meal, coefficient: 0.8, courseCoefficients: { dessert: 0.5 }, notes: "" };
    const cenaId = await plannerApi.savePlanned({ ...plan, date: "2026-11-02", slot: "Cena", guests: 40 });
    // A menu goes once per day: lunch uses a copy (same recipes, so the same quantities).
    const lunchMeal = await duplicateMeal(meal);
    const pranzo = await plannerApi.savePlanned({ ...plan, mealId: lunchMeal, date: "2026-11-02", slot: "Pranzo", guests: 10, courseCoefficients: {} });
    // Editing replaces the overrides.
    await plannerApi.savePlanned({ ...plan, mealId: lunchMeal, id: pranzo, date: "2026-11-02", slot: "Pranzo", guests: 20 });
    await plannerApi.savePlanned({ ...plan, date: "2026-11-20", slot: "Pranzo", guests: 99 }); // outside range

    const entries = await plannerApi.fetchPlanned("2026-11-02", "2026-11-08");

    expect(entries.map((e) => e.slot)).toEqual(["Pranzo", "Cena"]); // slot order within the day
    // Filtered by menu: every date, not only the range.
    expect((await plannerApi.fetchPlannedForMeal(meal)).map((e) => `${e.date} ${e.slot}`)).toEqual([
      "2026-11-02 Cena",
      "2026-11-20 Pranzo",
    ]);

    const cena = plannerApi.scalePlanned(entries[1]);
    expect(cena.map((c) => c.course)).toEqual(["first", "dessert"]);
    // Tagliatelle: 40 guests / 4 base * 0.8 = x8 -> 3200 g flour, 32 eggs
    expect(cena[0].recipes[0].factor).toBeCloseTo(8);
    expect(cena[0].recipes[0].lines.map((l) => l.quantity)).toEqual([3200, 32]);
    // Torta uses its own course coefficient: 40 / 8 * 0.5 = x2.5
    expect(cena.map((c) => c.coefficient)).toEqual([0.8, 0.5]);
    expect(cena[1].recipes[0].factor).toBeCloseTo(2.5);

    // Per-recipe guests: 10 tagliatelle instead of 40 -> 10 / 4 * 0.8 = x2
    await plannerApi.savePlanned({ ...plan, id: cenaId, date: "2026-11-02", slot: "Cena", guests: 40, recipeGuests: { [pasta]: 10 } });
    const [cenaOverride] = plannerApi.scalePlanned((await plannerApi.fetchPlanned("2026-11-02", "2026-11-02"))[1]);
    expect(cenaOverride.recipes[0].guests).toBe(10);
    expect(cenaOverride.recipes[0].factor).toBeCloseTo(2);
    await plannerApi.savePlanned({ ...plan, id: cenaId, date: "2026-11-02", slot: "Cena", guests: 40, recipeGuests: { [pasta]: null } });

    const lines = aggregate(entries.flatMap((e) => plannerApi.scalePlanned(e).flatMap((c) => c.recipes.flatMap((r) => r.lines))));
    // Flour: pasta (3200 + 1600 g) + cake (0.3 kg * 40/8*0.5 = 0.75 kg, 0.3 * 20/8*0.5 = 0.375 kg) = 5.925 kg
    expect(lines.map((l) => [l.ingredientName, +l.quantity.toFixed(3), l.unit.symbol])).toEqual([
      ["Farina", 5.925, "kg"],
      ["Uova", 48, "pz"],
    ]);
  });
});
