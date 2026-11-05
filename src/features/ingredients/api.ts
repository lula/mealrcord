import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { asc, count, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { ingredientCategories, ingredients, recipeIngredients } from "@/db/schema";
import { useDbMutation } from "@/lib/query";
import { DEFAULT_UNIT_ID } from "@/lib/units";

/** Ingredients with the number of recipes using each. */
export const listIngredients = () =>
  db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      defaultUnitId: ingredients.defaultUnitId,
      categoryId: ingredients.categoryId,
      usage: count(recipeIngredients.recipeId),
    })
    .from(ingredients)
    .leftJoin(recipeIngredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .groupBy(ingredients.id)
    .orderBy(asc(ingredients.name));

export const useIngredients = () => useQuery({ queryKey: ["ingredients"], queryFn: listIngredients });

export async function createIngredient(input: { name: string; defaultUnitId?: string | null; categoryId?: string | null }) {
  const id = newId();
  await db
    .insert(ingredients)
    .values({ id, name: input.name.trim(), defaultUnitId: input.defaultUnitId ?? DEFAULT_UNIT_ID, categoryId: input.categoryId ?? null })
    .run();
  return id;
}

export const useCreateIngredient = () => useDbMutation(createIngredient);

export const updateIngredient = (i: { id: string; name: string; defaultUnitId: string | null; categoryId: string | null }) =>
  db
    .update(ingredients)
    .set({ name: i.name.trim(), defaultUnitId: i.defaultUnitId, categoryId: i.categoryId })
    .where(eq(ingredients.id, i.id))
    .run();

export const useUpdateIngredient = () => useDbMutation(updateIngredient, { success: "Ingrediente aggiornato" });

export const useDeleteIngredient = () =>
  useDbMutation((id: string) => db.delete(ingredients).where(eq(ingredients.id, id)).run(), {
    success: "Ingrediente eliminato",
  });

// Categories

export const useIngredientCategories = () =>
  useQuery({
    queryKey: ["ingredient-categories"],
    queryFn: () => db.select().from(ingredientCategories).orderBy(asc(ingredientCategories.name)),
  });

export async function createIngredientCategory(name: string) {
  const id = newId();
  await db.insert(ingredientCategories).values({ id, name: name.trim() }).run();
  return id;
}

export const useCreateIngredientCategory = () => useDbMutation(createIngredientCategory);

export const useDeleteIngredientCategory = () =>
  useDbMutation((id: string) => db.delete(ingredientCategories).where(eq(ingredientCategories.id, id)).run(), {
    success: "Categoria eliminata",
  });

export const NO_CATEGORY_LABEL = "Senza categoria";

/**
 * Groups lines by their ingredient's category: categories in the given order
 * (empty ones skipped), then "Senza categoria" last.
 */
export function groupByCategory<T extends { ingredientId: string }>(
  lines: T[],
  categories: { id: string; name: string }[],
  categoryOf: Map<string, string | null>,
): { id: string | null; name: string; lines: T[] }[] {
  const groups = [...categories.map((c) => ({ id: c.id as string | null, name: c.name, lines: [] as T[] })), { id: null, name: NO_CATEGORY_LABEL, lines: [] as T[] }];
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const l of lines) (byId.get(categoryOf.get(l.ingredientId) ?? null) ?? byId.get(null)!).lines.push(l);
  return groups.filter((g) => g.lines.length);
}

/** Groups lines by the current categories of their ingredients (see `groupByCategory`). */
export function useGroupByCategory<T extends { ingredientId: string }>(lines: T[]) {
  const { data: ingredients = [] } = useIngredients();
  const { data: categories = [] } = useIngredientCategories();
  return useMemo(
    () => groupByCategory(lines, categories, new Map(ingredients.map((i) => [i.id, i.categoryId]))),
    [lines, categories, ingredients],
  );
}
