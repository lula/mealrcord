import { useQuery } from "@tanstack/react-query";
import { asc, count, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { ingredients, recipeIngredients } from "@/db/schema";
import { useDbMutation } from "@/lib/query";
import { DEFAULT_UNIT_ID } from "@/lib/units";

/** Ingredients with the number of recipes using each. */
export const useIngredients = () =>
  useQuery({
    queryKey: ["ingredients"],
    queryFn: () =>
      db
        .select({
          id: ingredients.id,
          name: ingredients.name,
          defaultUnitId: ingredients.defaultUnitId,
          usage: count(recipeIngredients.recipeId),
        })
        .from(ingredients)
        .leftJoin(recipeIngredients, eq(recipeIngredients.ingredientId, ingredients.id))
        .groupBy(ingredients.id)
        .orderBy(asc(ingredients.name)),
  });

export async function createIngredient(input: { name: string; defaultUnitId?: string | null }) {
  const id = newId();
  await db.insert(ingredients).values({ id, name: input.name.trim(), defaultUnitId: input.defaultUnitId ?? DEFAULT_UNIT_ID }).run();
  return id;
}

export const useCreateIngredient = () => useDbMutation(createIngredient);

export const useUpdateIngredient = () =>
  useDbMutation(
    (i: { id: string; name: string; defaultUnitId: string | null }) =>
      db.update(ingredients).set({ name: i.name.trim(), defaultUnitId: i.defaultUnitId }).where(eq(ingredients.id, i.id)).run(),
    { success: "Ingrediente aggiornato" },
  );

export const useDeleteIngredient = () =>
  useDbMutation((id: string) => db.delete(ingredients).where(eq(ingredients.id, id)).run(), {
    success: "Ingrediente eliminato",
  });
