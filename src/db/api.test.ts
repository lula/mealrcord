import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "@/test/fake-tauri-db";

let fake = createFakeDb();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, args: unknown) => fake.invoke(cmd, args) }));
// Hooks import sonner/react-query; only the plain async functions are used here.
vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

const { saveRecipe, getRecipe, mealsUsingRecipe } = await import("@/features/recipes/api");
const { createIngredient } = await import("@/features/ingredients/api");
const { saveMeal, plannedUsageCount } = await import("@/features/meals/api");
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

  it("reports where recipes and meals are used", async () => {
    const { pasta, meal } = await seed();
    expect(await mealsUsingRecipe(pasta)).toEqual(["Menu del giorno"]);
    await db.insert(plannedMeals).values({ id: "p1", date: "2026-11-02", slot: "Pranzo", mealId: meal, guests: 40 }).run();
    expect(await plannedUsageCount(meal)).toBe(1);
  });

  it("scales planned meals to guests and builds the shopping list", async () => {
    const { meal } = await seed();
    // Dessert overrides the planned coefficient (0.8) with its own (0.5).
    const plan = { mealId: meal, coefficient: 0.8, courseCoefficients: { dessert: 0.5 }, notes: "" };
    await plannerApi.savePlanned({ ...plan, date: "2026-11-02", slot: "Cena", guests: 40 });
    const pranzo = await plannerApi.savePlanned({ ...plan, date: "2026-11-02", slot: "Pranzo", guests: 10, courseCoefficients: {} });
    // Editing replaces the overrides.
    await plannerApi.savePlanned({ ...plan, id: pranzo, date: "2026-11-02", slot: "Pranzo", guests: 20 });
    await plannerApi.savePlanned({ ...plan, date: "2026-11-20", slot: "Pranzo", guests: 99 }); // outside range

    const entries = await plannerApi.fetchPlanned("2026-11-02", "2026-11-08");

    expect(entries.map((e) => e.slot)).toEqual(["Pranzo", "Cena"]); // slot order within the day

    const cena = plannerApi.scalePlanned(entries[1]);
    expect(cena.map((c) => c.course)).toEqual(["first", "dessert"]);
    // Tagliatelle: 40 guests / 4 base * 0.8 = x8 -> 3200 g flour, 32 eggs
    expect(cena[0].recipes[0].factor).toBeCloseTo(8);
    expect(cena[0].recipes[0].lines.map((l) => l.quantity)).toEqual([3200, 32]);
    // Torta uses its own course coefficient: 40 / 8 * 0.5 = x2.5
    expect(cena.map((c) => c.coefficient)).toEqual([0.8, 0.5]);
    expect(cena[1].recipes[0].factor).toBeCloseTo(2.5);

    const lines = aggregate(entries.flatMap((e) => plannerApi.scalePlanned(e).flatMap((c) => c.recipes.flatMap((r) => r.lines))));
    // Flour: pasta (3200 + 1600 g) + cake (0.3 kg * 40/8*0.5 = 0.75 kg, 0.3 * 20/8*0.5 = 0.375 kg) = 5.925 kg
    expect(lines.map((l) => [l.ingredientName, +l.quantity.toFixed(3), l.unit.symbol])).toEqual([
      ["Farina", 5.925, "kg"],
      ["Uova", 48, "pz"],
    ]);
  });
});
