import { useQuery } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { db, newId, nowIso } from "@/db/client";
import { dishes, dishRecipes, mealRecipes, meals, recipeIngredients, recipes, recipeTags } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

type WithIngredientAllergens = { ingredients: { ingredient: { allergens: { allergen: { id: string; name: string } }[] } }[] };

/** A recipe's allergens: those of its ingredients, without duplicates, by name. */
export function allergensOf(r: WithIngredientAllergens) {
  const byId = new Map(r.ingredients.flatMap((ri) => ri.ingredient.allergens.map((a) => [a.allergen.id, a.allergen] as const)));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const useRecipes = () =>
  useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const rows = await db.query.recipes.findMany({
        with: {
          tags: { with: { tag: true } },
          ingredients: {
            columns: { ingredientId: true },
            with: { ingredient: { columns: { id: true }, with: { allergens: { with: { allergen: true } } } } },
          },
        },
        orderBy: (r, { asc }) => [asc(r.name)],
      });
      return rows.map((r) => ({ ...r, allergens: allergensOf(r) }));
    },
  });

export type RecipeListItem = NonNullable<ReturnType<typeof useRecipes>["data"]>[number];

export async function getRecipe(id: string) {
  const r = await db.query.recipes.findFirst({
    where: eq(recipes.id, id),
    with: {
      tags: { with: { tag: true } },
      ingredients: {
        with: { ingredient: { with: { allergens: { with: { allergen: true } } } }, unit: true },
        orderBy: (ri, { asc }) => [asc(ri.position)],
      },
    },
  });
  return r && { ...r, allergens: allergensOf(r) };
}

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
