import { useQuery } from "@tanstack/react-query";
import { count, eq } from "drizzle-orm";
import { db, newId, nowIso } from "@/db/client";
import { COURSES, mealRecipes, meals, plannedMeals, type Course } from "@/db/schema";
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
        with: { recipes: { with: { recipe: true }, orderBy: (mr, { asc }) => [asc(mr.position)] } },
        orderBy: (m, { asc }) => [asc(m.name)],
      }),
  });

export type MealListItem = NonNullable<ReturnType<typeof useMeals>["data"]>[number];

export const useMeal = (id: string | undefined) =>
  useQuery({
    queryKey: ["meal", id],
    queryFn: () => db.query.meals.findFirst({
        where: eq(meals.id, id!),
        with: { recipes: { with: { recipe: true }, orderBy: (mr, { asc }) => [asc(mr.position)] } },
      }),
    enabled: !!id,
  });

export type MealInput = {
  id?: string;
  name: string;
  notes: string;
  courses: Record<Course, string[]>; // recipe ids per course, in order
};

export async function saveMeal(input: MealInput): Promise<string> {
  const total = COURSES.reduce((n, c) => n + input.courses[c].length, 0);
  if (total === 0) throw new Error("Aggiungi almeno una ricetta a una portata");
  const all = COURSES.flatMap((c) => input.courses[c]);
  if (new Set(all).size !== all.length) throw new Error("Una ricetta può comparire una sola volta nel menu");

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
  ]);
  return id;
}

export const useSaveMeal = () => useDbMutation(saveMeal, { success: "Menu salvato" });

export async function plannedUsageCount(mealId: string) {
  const [row] = await db.select({ n: count() }).from(plannedMeals).where(eq(plannedMeals.mealId, mealId));
  return row?.n ?? 0;
}

export const useDeleteMeal = () =>
  useDbMutation((id: string) => db.delete(meals).where(eq(meals.id, id)).run(), { success: "Menu eliminato" });
