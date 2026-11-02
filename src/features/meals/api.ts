import { useQuery } from "@tanstack/react-query";
import { count, eq } from "drizzle-orm";
import { db, newId, nowIso } from "@/db/client";
import { COURSES, mealDishes, mealRecipes, meals, plannedMeals, type Course } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

export const COURSE_LABELS: Record<Course, string> = {
  starter: "Antipasti",
  first: "Primi",
  main: "Secondi",
  dessert: "Dolci",
};

/** System tag that matches each course (see 001_init.sql seed). */
export const COURSE_TAG_ID: Record<Course, string> = {
  starter: "tag-starter",
  first: "tag-first",
  main: "tag-main",
  dessert: "tag-dessert",
};

export const useMeals = () =>
  useQuery({
    queryKey: ["meals"],
    queryFn: () => db.query.meals.findMany({
        with: {
          recipes: { with: { recipe: true }, orderBy: (mr, { asc }) => [asc(mr.position)] },
          dishes: { with: { dish: true }, orderBy: (md, { asc }) => [asc(md.position)] },
          planned: { columns: { id: true } },
        },
        orderBy: (m, { asc }) => [asc(m.name)],
      }),
  });

export type MealListItem = NonNullable<ReturnType<typeof useMeals>["data"]>[number];

export const useMeal = (id: string | undefined) =>
  useQuery({
    queryKey: ["meal", id],
    queryFn: () => db.query.meals.findFirst({
        where: eq(meals.id, id!),
        with: {
          recipes: { with: { recipe: true }, orderBy: (mr, { asc }) => [asc(mr.position)] },
          dishes: { with: { dish: true }, orderBy: (md, { asc }) => [asc(md.position)] },
          planned: { columns: { id: true } },
        },
      }),
    enabled: !!id,
  });

/** A menu used in the planner cannot change, so past and future plans stay as planned. */
export const LOCKED_MESSAGE = "Il menu è nel planner e non si può più modificare. Duplicalo per crearne una variante.";

export type MealInput = {
  id?: string;
  name: string;
  notes: string;
  courses: Record<Course, string[]>; // recipe ids per course, in order
  /** "Piatti unici" of the menu, in order. */
  dishIds?: string[];
};

export async function saveMeal(input: MealInput): Promise<string> {
  const dishIds = input.dishIds ?? [];
  const total = COURSES.reduce((n, c) => n + input.courses[c].length, 0) + dishIds.length;
  if (total === 0) throw new Error("Aggiungi almeno una ricetta a una portata o un piatto unico");
  if (new Set(dishIds).size !== dishIds.length) throw new Error("Un piatto unico può comparire una sola volta nel menu");
  const all = COURSES.flatMap((c) => input.courses[c]);
  if (new Set(all).size !== all.length) throw new Error("Una ricetta può comparire una sola volta nel menu");

  if (input.id && (await plannedUsageCount(input.id)) > 0) throw new Error(LOCKED_MESSAGE);

  const id = input.id ?? newId();
  const now = nowIso();
  const fields = { name: input.name.trim(), notes: input.notes.trim(), updatedAt: now };
  const head = input.id
    ? db.update(meals).set(fields).where(eq(meals.id, id))
    : db.insert(meals).values({ id, ...fields, createdAt: now });

  await db.batch([
    head,
    db.delete(mealRecipes).where(eq(mealRecipes.mealId, id)),
    ...COURSES.flatMap((course) =>
      input.courses[course].map((recipeId, position) => db.insert(mealRecipes).values({ mealId: id, recipeId, course, position })),
    ),
    db.delete(mealDishes).where(eq(mealDishes.mealId, id)),
    ...dishIds.map((dishId, position) => db.insert(mealDishes).values({ mealId: id, dishId, position })),
  ]);
  return id;
}

/** Copies a menu (name + " (copia)", notes, recipes per course) and returns the new id. */
export async function duplicateMeal(id: string): Promise<string> {
  const m = await db.query.meals.findFirst({
    where: eq(meals.id, id),
    with: { recipes: { orderBy: (mr, { asc }) => [asc(mr.position)] }, dishes: { orderBy: (md, { asc }) => [asc(md.position)] } },
  });
  if (!m) throw new Error("Menu non trovato");
  const courses = Object.fromEntries(COURSES.map((c) => [c, m.recipes.filter((r) => r.course === c).map((r) => r.recipeId)])) as Record<Course, string[]>;
  return saveMeal({ name: `${m.name} (copia)`, notes: m.notes, courses, dishIds: m.dishes.map((d) => d.dishId) });
}

export const useDuplicateMeal = () => useDbMutation(duplicateMeal, { success: "Menu duplicato" });

export const useSaveMeal = () => useDbMutation(saveMeal, { success: "Menu salvato" });

export async function plannedUsageCount(mealId: string) {
  const [row] = await db.select({ n: count() }).from(plannedMeals).where(eq(plannedMeals.mealId, mealId));
  return row?.n ?? 0;
}

export const useDeleteMeal = () =>
  useDbMutation((id: string) => db.delete(meals).where(eq(meals.id, id)).run(), { success: "Menu eliminato" });

/** Removes every planned occurrence of a menu (with their per-course/recipe/dish values). The menu stays. */
export async function removeFromPlanner(mealId: string) {
  await db.delete(plannedMeals).where(eq(plannedMeals.mealId, mealId)).run();
}

export const useRemoveFromPlanner = () => useDbMutation(removeFromPlanner, { success: "Menu rimosso dal planner" });
