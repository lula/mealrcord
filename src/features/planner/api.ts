import { useQuery } from "@tanstack/react-query";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { COURSES, plannedMealCourseCoefficients, plannedMeals, type Course } from "@/db/schema";
import { useDbMutation } from "@/lib/query";
import { scaleFactor } from "@/lib/scaling";
import type { QuantityLine } from "@/lib/units";

export const SLOT_SUGGESTIONS = ["Colazione", "Pranzo", "Cena"];

const slotRank = (slot: string) => {
  const i = SLOT_SUGGESTIONS.indexOf(slot);
  return i === -1 ? SLOT_SUGGESTIONS.length : i;
};

export async function fetchPlanned(from: string, to: string) {
  const rows = await db.query.plannedMeals.findMany({
    where: and(gte(plannedMeals.date, from), lte(plannedMeals.date, to)),
    with: {
      courseCoefficients: true,
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
        },
      },
    },
  });
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || slotRank(a.slot) - slotRank(b.slot) || a.slot.localeCompare(b.slot) || a.position - b.position,
  );
}

export type PlannedEntry = Awaited<ReturnType<typeof fetchPlanned>>[number];

/** Planned meals between two yyyy-MM-dd dates, inclusive. */
export const usePlanned = (from: string, to: string) =>
  useQuery({ queryKey: ["planned", from, to], queryFn: () => fetchPlanned(from, to) });

export type ScaledRecipe = {
  recipeId: string;
  name: string;
  factor: number;
  lines: (QuantityLine & { key: string })[];
};

/** Coefficient of one course: its own if set, else the planned meal's. */
export function courseCoefficient(
  entry: { coefficient: number; courseCoefficients: { course: Course; coefficient: number }[] },
  course: Course,
): number {
  return entry.courseCoefficients.find((c) => c.course === course)?.coefficient ?? entry.coefficient;
}

/** Recipes of a planned meal grouped by course, with quantities for its guests. */
export function scalePlanned(entry: PlannedEntry): { course: Course; coefficient: number; recipes: ScaledRecipe[] }[] {
  return COURSES.map((course) => ({
    course,
    coefficient: courseCoefficient(entry, course),
  })).map(({ course, coefficient }) => ({
    course,
    coefficient,
    recipes: entry.meal.recipes
      .filter((mr) => mr.course === course)
      .map(({ recipe }) => {
        const factor = scaleFactor(entry.guests, recipe.baseServings, coefficient);
        return {
          recipeId: recipe.id,
          name: recipe.name,
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
  })).filter((c) => c.recipes.length > 0);
}

export type PlannedInput = {
  id?: string;
  date: string;
  slot: string;
  mealId: string;
  guests: number;
  coefficient: number;
  /** Per-course coefficient; null or missing = use `coefficient`. */
  courseCoefficients?: Partial<Record<Course, number | null>>;
  notes: string;
};

export async function savePlanned(p: PlannedInput): Promise<string> {
  const { id: existingId, courseCoefficients = {}, ...fields } = p;
  const id = existingId ?? newId();
  const values = { ...fields, slot: fields.slot.trim() || "Pranzo", notes: fields.notes.trim() };
  await db.batch([
    existingId ? db.update(plannedMeals).set(values).where(eq(plannedMeals.id, id)) : db.insert(plannedMeals).values({ id, ...values }),
    db.delete(plannedMealCourseCoefficients).where(eq(plannedMealCourseCoefficients.plannedMealId, id)),
    ...COURSES.flatMap((course) => {
      const coefficient = courseCoefficients[course];
      return coefficient == null ? [] : [db.insert(plannedMealCourseCoefficients).values({ plannedMealId: id, course, coefficient })];
    }),
  ]);
  return id;
}

export const useSavePlanned = () => useDbMutation(savePlanned, { success: "Planner aggiornato" });

export const useDeletePlanned = () =>
  useDbMutation((id: string) => db.delete(plannedMeals).where(eq(plannedMeals.id, id)).run(), {
    success: "Rimosso dal planner",
  });
