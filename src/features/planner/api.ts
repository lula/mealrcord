import { useQuery } from "@tanstack/react-query";
import { and, eq, gte, lte, max, ne, type SQL } from "drizzle-orm";
import { format, parseISO } from "date-fns";
import { db, newId } from "@/db/client";
import { COURSES, meals, plannedMealCourseCoefficients, plannedMealDishGuests, plannedMealRecipeGuests, plannedMeals, type Course } from "@/db/schema";
import { useDbMutation } from "@/lib/query";
import { scaleFactor } from "@/lib/scaling";
import type { QuantityLine } from "@/lib/units";

export const SLOT_SUGGESTIONS = ["Colazione", "Pranzo", "Cena"];

const slotRank = (slot: string) => {
  const i = SLOT_SUGGESTIONS.indexOf(slot);
  return i === -1 ? SLOT_SUGGESTIONS.length : i;
};

/** Planned meals matching `where`, with everything needed to show and scale them, by date and slot. */
async function findPlanned(where: SQL | undefined) {
  const rows = await db.query.plannedMeals.findMany({
    where,
    with: {
      courseCoefficients: true,
      recipeGuests: true,
      dishGuests: true,
      meal: {
        with: {
          recipes: {
            orderBy: (mr, { asc }) => [asc(mr.position)],
            with: {
              recipe: {
                with: {
                  ingredients: {
                    orderBy: (ri, { asc }) => [asc(ri.position)],
                    with: { ingredient: true, unit: true },
                  },
                },
              },
            },
          },
          dishes: {
            orderBy: (md, { asc }) => [asc(md.position)],
            with: {
              dish: {
                with: {
                  recipes: {
                    orderBy: (dr, { asc }) => [asc(dr.position)],
                    with: {
                      recipe: {
                        with: {
                          ingredients: {
                            orderBy: (ri, { asc }) => [asc(ri.position)],
                            with: { ingredient: true, unit: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || slotRank(a.slot) - slotRank(b.slot) || a.slot.localeCompare(b.slot) || a.position - b.position,
  );
}

export const fetchPlanned = (from: string, to: string) => findPlanned(and(gte(plannedMeals.date, from), lte(plannedMeals.date, to)));

/** Every planned occurrence of one menu, oldest first. */
export const fetchPlannedForMeal = (mealId: string) => findPlanned(eq(plannedMeals.mealId, mealId));

export type PlannedEntry = Awaited<ReturnType<typeof fetchPlanned>>[number];

/** Planned meals between two yyyy-MM-dd dates, inclusive. */
export const usePlanned = (from: string, to: string) =>
  useQuery({ queryKey: ["planned", from, to], queryFn: () => fetchPlanned(from, to) });

export const usePlannedEntry = (id: string | undefined) =>
  useQuery({ queryKey: ["planned", "entry", id], queryFn: async () => (await findPlanned(eq(plannedMeals.id, id!)))[0] ?? null, enabled: !!id });

/** A menu with its recipes and ingredients, to preview quantities before saving. */
export const useMealForScaling = (mealId: string | undefined) =>
  useQuery({
    queryKey: ["meal", "scaling", mealId],
    queryFn: async () =>
      (await db.query.meals.findFirst({
        where: eq(meals.id, mealId!),
        with: {
          recipes: {
            orderBy: (mr, { asc }) => [asc(mr.position)],
            with: {
              recipe: {
                with: {
                  ingredients: {
                    orderBy: (ri, { asc }) => [asc(ri.position)],
                    with: { ingredient: true, unit: true },
                  },
                },
              },
            },
          },
          dishes: {
            orderBy: (md, { asc }) => [asc(md.position)],
            with: {
              dish: {
                with: {
                  recipes: {
                    orderBy: (dr, { asc }) => [asc(dr.position)],
                    with: {
                      recipe: {
                        with: {
                          ingredients: {
                            orderBy: (ri, { asc }) => [asc(ri.position)],
                            with: { ingredient: true, unit: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })) ?? null,
    enabled: !!mealId,
  });

export const usePlannedForMeal = (mealId: string | undefined) =>
  useQuery({ queryKey: ["planned", "meal", mealId], queryFn: () => fetchPlannedForMeal(mealId!), enabled: !!mealId });

export type ScaledRecipe = {
  recipeId: string;
  name: string;
  /** Guests this recipe is made for (the planned meal's unless overridden). */
  guests: number;
  factor: number;
  lines: (QuantityLine & { key: string })[];
};

/** Coefficient of one course: its own if set, else 1. */
export function courseCoefficient(entry: { courseCoefficients: { course: Course; coefficient: number }[] }, course: Course): number {
  return entry.courseCoefficients.find((c) => c.course === course)?.coefficient ?? 1;
}

/**
 * Guests for each recipe of one course. Recipes with an override keep it; the
 * others share what is left of `total` evenly (20 for 3 recipes -> 7, 7, 6).
 */
export function courseGuests(total: number, recipeIds: string[], overrides: Record<string, number | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  const free = recipeIds.filter((id) => overrides[id] == null);
  let left = Math.max(0, total - recipeIds.reduce((n, id) => n + (overrides[id] ?? 0), 0));
  recipeIds.forEach((id) => {
    if (overrides[id] != null) out[id] = overrides[id];
  });
  free.forEach((id, i) => {
    const share = Math.ceil(left / (free.length - i));
    out[id] = share;
    left -= share;
  });
  return out;
}

/** True when a course's guests go over `total` by more than `percent`. */
export function exceedsGuests(courseTotal: number, total: number, percent: number): boolean {
  return courseTotal > total * (1 + percent / 100);
}

/** Recipes of a planned meal grouped by course, with quantities for its guests. */
/** What scaling needs: a planned meal, or the values being edited in the form. */
export type ScalableEntry = {
  guests: number;
  courseCoefficients: { course: Course; coefficient: number }[];
  recipeGuests: { recipeId: string; guests: number }[];
  /** Coefficient of the menu's "piatti unici"; null = 1. */
  dishCoefficient: number | null;
  dishGuests: { dishId: string; guests: number }[];
  meal: PlannedEntry["meal"];
};

export function scalePlanned(entry: ScalableEntry): { course: Course; coefficient: number; recipes: ScaledRecipe[] }[] {
  const overrides = Object.fromEntries(entry.recipeGuests.map((g) => [g.recipeId, g.guests]));
  return COURSES.map((course) => {
    const coefficient = courseCoefficient(entry, course);
    const inCourse = entry.meal.recipes.filter((mr) => mr.course === course);
    const guestsById = courseGuests(entry.guests, inCourse.map((mr) => mr.recipeId), overrides);
    return {
      course,
      coefficient,
      recipes: inCourse.map(({ recipe }) => {
        const guests = guestsById[recipe.id];
        const factor = scaleFactor(guests, recipe.baseServings, coefficient);
        return {
          recipeId: recipe.id,
          name: recipe.name,
          guests,
          factor,
          lines: recipe.ingredients.map((ri) => ({
            key: ri.ingredientId,
            ingredientId: ri.ingredientId,
            ingredientName: ri.ingredient.name,
            quantity: ri.quantity * factor,
            unit: ri.unit,
          })),
        };
      }),
    };
  }).filter((c) => c.recipes.length > 0);
}

export type ScaledDish = {
  dishId: string;
  name: string;
  /** Guests this dish is made for. */
  guests: number;
  /** Each recipe with its coefficient within the dish (already in `factor`). */
  recipes: (ScaledRecipe & { coefficient: number })[];
};

/**
 * The "piatti unici" of a planned meal: guests are split among the dishes like
 * recipes in a course; each recipe is scaled by the group and its own coefficient.
 */
export function scalePlannedDishes(entry: ScalableEntry): { coefficient: number; dishes: ScaledDish[] } | null {
  if (entry.meal.dishes.length === 0) return null;
  const coefficient = entry.dishCoefficient ?? 1;
  const overrides = Object.fromEntries(entry.dishGuests.map((g) => [g.dishId, g.guests]));
  const guestsById = courseGuests(entry.guests, entry.meal.dishes.map((md) => md.dishId), overrides);
  return {
    coefficient,
    dishes: entry.meal.dishes.map(({ dish }) => {
      const guests = guestsById[dish.id];
      return {
        dishId: dish.id,
        name: dish.name,
        guests,
        recipes: dish.recipes.map(({ recipe, coefficient: recipeCoefficient }) => {
          const factor = scaleFactor(guests, recipe.baseServings, coefficient * recipeCoefficient);
          return {
            recipeId: recipe.id,
            name: recipe.name,
            guests,
            factor,
            coefficient: recipeCoefficient,
            lines: recipe.ingredients.map((ri) => ({
              key: ri.ingredientId,
              ingredientId: ri.ingredientId,
              ingredientName: ri.ingredient.name,
              quantity: ri.quantity * factor,
              unit: ri.unit,
            })),
          };
        }),
      };
    }),
  };
}

/** True when a course or the "piatti unici" of a planned meal go over its guests by more than `percent`. */
export function plannedExceedsGuests(entry: ScalableEntry, percent: number): boolean {
  const totals = [
    ...scalePlanned(entry).map((c) => c.recipes.reduce((n, r) => n + r.guests, 0)),
    ...(scalePlannedDishes(entry) ? [scalePlannedDishes(entry)!.dishes.reduce((n, d) => n + d.guests, 0)] : []),
  ];
  return totals.some((t) => exceedsGuests(t, entry.guests, percent));
}

/** Every ingredient line of a planned meal: course recipes and "piatti unici". */
export function plannedLines(entry: ScalableEntry): QuantityLine[] {
  return [
    ...scalePlanned(entry).flatMap((c) => c.recipes.flatMap((r) => r.lines)),
    ...(scalePlannedDishes(entry)?.dishes.flatMap((d) => d.recipes.flatMap((r) => r.lines)) ?? []),
  ];
}

export type PlannedInput = {
  id?: string;
  date: string;
  slot: string;
  mealId: string;
  guests: number;
  /** Per-course coefficient; null or missing = 1. */
  courseCoefficients?: Partial<Record<Course, number | null>>;
  /** Per-recipe guests, by recipe id; null or missing = use `guests`. */
  recipeGuests?: Record<string, number | null>;
  /** Coefficient of the "piatti unici"; null or missing = 1. */
  dishCoefficient?: number | null;
  /** Per-dish guests, by dish id; null or missing = even split. */
  dishGuests?: Record<string, number | null>;
  notes: string;
};

/** Throws when the menu is already planned on that day (by another planned meal than `exceptId`). */
async function assertFreeDay(mealId: string, date: string, exceptId?: string) {
  const clash = await db.query.plannedMeals.findFirst({
    where: and(eq(plannedMeals.mealId, mealId), eq(plannedMeals.date, date), exceptId ? ne(plannedMeals.id, exceptId) : undefined),
    with: { meal: { columns: { name: true } } },
  });
  if (clash) throw new Error(`«${clash.meal.name}» è già pianificato il ${format(parseISO(date), "d MMMM")}.`);
}

export async function savePlanned(p: PlannedInput): Promise<string> {
  const { id: existingId, courseCoefficients = {}, recipeGuests = {}, dishGuests = {}, dishCoefficient = null, ...fields } = p;
  await assertFreeDay(fields.mealId, fields.date, existingId);
  const id = existingId ?? newId();
  const values = { ...fields, dishCoefficient, slot: fields.slot.trim() || "Pranzo", notes: fields.notes.trim() };
  await db.batch([
    existingId ? db.update(plannedMeals).set(values).where(eq(plannedMeals.id, id)) : db.insert(plannedMeals).values({ id, ...values }),
    db.delete(plannedMealCourseCoefficients).where(eq(plannedMealCourseCoefficients.plannedMealId, id)),
    ...COURSES.flatMap((course) => {
      const coefficient = courseCoefficients[course];
      return coefficient == null ? [] : [db.insert(plannedMealCourseCoefficients).values({ plannedMealId: id, course, coefficient })];
    }),
    db.delete(plannedMealRecipeGuests).where(eq(plannedMealRecipeGuests.plannedMealId, id)),
    ...Object.entries(recipeGuests).flatMap(([recipeId, guests]) =>
      guests == null ? [] : [db.insert(plannedMealRecipeGuests).values({ plannedMealId: id, recipeId, guests })],
    ),
    db.delete(plannedMealDishGuests).where(eq(plannedMealDishGuests.plannedMealId, id)),
    ...Object.entries(dishGuests).flatMap(([dishId, guests]) =>
      guests == null ? [] : [db.insert(plannedMealDishGuests).values({ plannedMealId: id, dishId, guests })],
    ),
  ]);
  return id;
}

export const useSavePlanned = () => useDbMutation(savePlanned, { success: "Planner aggiornato" });

export const useDeletePlanned = () =>
  useDbMutation((id: string) => db.delete(plannedMeals).where(eq(plannedMeals.id, id)).run(), {
    success: "Rimosso dal planner",
  });

/** Position after the last planned meal of a day, so a moved/copied one goes to the end. */
async function nextPosition(date: string): Promise<number> {
  const [row] = await db.select({ max: max(plannedMeals.position) }).from(plannedMeals).where(eq(plannedMeals.date, date));
  return (row?.max ?? -1) + 1;
}

/** Moves a planned meal to another day. */
export async function movePlanned({ id, date }: { id: string; date: string }) {
  const p = await db.query.plannedMeals.findFirst({ where: eq(plannedMeals.id, id), columns: { mealId: true } });
  if (!p) throw new Error("Pianificazione non trovata");
  await assertFreeDay(p.mealId, date, id);
  await db.update(plannedMeals).set({ date, position: await nextPosition(date) }).where(eq(plannedMeals.id, id)).run();
}

/** Copies a planned meal (guests, coefficients and per-course/per-recipe values) to a day. Returns the new id. */
export async function copyPlanned({ id, date }: { id: string; date: string }): Promise<string> {
  const [p] = await findPlanned(eq(plannedMeals.id, id));
  if (!p) throw new Error("Pianificazione non trovata");
  const newId = await savePlanned({
    date,
    slot: p.slot,
    mealId: p.mealId,
    guests: p.guests,
    notes: p.notes,
    courseCoefficients: Object.fromEntries(p.courseCoefficients.map((c) => [c.course, c.coefficient])),
    recipeGuests: Object.fromEntries(p.recipeGuests.map((g) => [g.recipeId, g.guests])),
    dishCoefficient: p.dishCoefficient,
    dishGuests: Object.fromEntries(p.dishGuests.map((g) => [g.dishId, g.guests])),
  });
  await db.update(plannedMeals).set({ position: await nextPosition(date) }).where(eq(plannedMeals.id, newId)).run();
  return newId;
}

export const useMovePlanned = () => useDbMutation(movePlanned, { success: "Menu spostato" });
export const useCopyPlanned = () => useDbMutation(copyPlanned, { success: "Menu copiato" });

/** Plans the same menu with the same values on several days. Checks every day first, so nothing is saved if one is taken. */
export async function savePlannedOnDays({ dates, ...input }: Omit<PlannedInput, "id" | "date"> & { dates: string[] }): Promise<string[]> {
  if (dates.length === 0) throw new Error("Scegli almeno un giorno");
  for (const date of dates) await assertFreeDay(input.mealId, date);
  const ids: string[] = [];
  for (const date of dates) ids.push(await savePlanned({ ...input, date }));
  return ids;
}

export const useSavePlannedOnDays = () => useDbMutation(savePlannedOnDays, { success: "Planner aggiornato" });
