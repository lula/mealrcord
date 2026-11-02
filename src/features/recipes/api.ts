import { useQuery } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { db, newId, nowIso } from "@/db/client";
import { dishes, dishRecipes, mealRecipes, meals, recipeIngredients, recipes, recipeTags } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

export const useRecipes = () =>
  useQuery({
    queryKey: ["recipes"],
    queryFn: () =>
      db.query.recipes.findMany({
        with: { tags: { with: { tag: true } } },
        orderBy: (r, { asc }) => [asc(r.name)],
      }),
  });

export type RecipeListItem = NonNullable<ReturnType<typeof useRecipes>["data"]>[number];

export const getRecipe = (id: string) =>
  db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    with: {
      tags: { with: { tag: true } },
      ingredients: { with: { ingredient: true, unit: true }, orderBy: (ri, { asc }) => [asc(ri.position)] },
    },
  });

export const useRecipe = (id: string | undefined) =>
  useQuery({ queryKey: ["recipe", id], queryFn: () => getRecipe(id!), enabled: !!id });

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipe>>>;

export type RecipeInput = {
  id?: string;
  name: string;
  description: string;
  baseServings: number;
  ingredients: { ingredientId: string; quantity: number; unitId: string }[];
  tagIds: string[];
};

/** Creates or replaces a recipe with its ingredients and tags in one transaction. */
export async function saveRecipe(input: RecipeInput): Promise<string> {
  const id = input.id ?? newId();
  const now = nowIso();
  const fields = { name: input.name.trim(), description: input.description.trim(), baseServings: input.baseServings, updatedAt: now };

  const head = input.id
    ? db.update(recipes).set(fields).where(eq(recipes.id, id))
    : db.insert(recipes).values({ id, ...fields, createdAt: now });

  await db.batch([
    head,
    db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)),
    db.delete(recipeTags).where(eq(recipeTags.recipeId, id)),
    ...input.ingredients.map((ri, position) => db.insert(recipeIngredients).values({ recipeId: id, ...ri, position })),
    ...input.tagIds.map((tagId) => db.insert(recipeTags).values({ recipeId: id, tagId })),
  ]);
  return id;
}

export const useSaveRecipe = () => useDbMutation(saveRecipe, { success: "Ricetta salvata" });

/** Names of the meals that use a recipe (a recipe in use cannot be deleted). */
export async function mealsUsingRecipe(recipeId: string) {
  const rows = await db
    .selectDistinct({ name: meals.name })
    .from(mealRecipes)
    .innerJoin(meals, eq(meals.id, mealRecipes.mealId))
    .where(eq(mealRecipes.recipeId, recipeId));
  return rows.map((r) => r.name);
}

/** Names of the "piatti unici" that use a recipe. */
export async function dishesUsingRecipe(recipeId: string) {
  const rows = await db.select({ name: dishes.name }).from(dishRecipes).innerJoin(dishes, eq(dishes.id, dishRecipes.dishId)).where(eq(dishRecipes.recipeId, recipeId));
  return rows.map((r) => r.name);
}

export const useDeleteRecipe = () =>
  useDbMutation((id: string) => db.delete(recipes).where(eq(recipes.id, id)).run(), { success: "Ricetta eliminata" });

export const useDuplicateRecipe = () =>
  useDbMutation(
    async (id: string) => {
      const r = await getRecipe(id);
      if (!r) throw new Error("Ricetta non trovata");
      return saveRecipe({
        name: `${r.name} (copia)`,
        description: r.description,
        baseServings: r.baseServings,
        ingredients: r.ingredients.map(({ ingredientId, quantity, unitId }) => ({ ingredientId, quantity, unitId })),
        tagIds: r.tags.map((t) => t.tagId),
      });
    },
    { success: "Ricetta duplicata" },
  );
