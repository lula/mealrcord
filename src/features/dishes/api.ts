import { useQuery } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { db, newId, nowIso } from "@/db/client";
import { dishes, dishRecipes, mealDishes } from "@/db/schema";
import { getSettings } from "@/features/settings/api";
import { useDbMutation } from "@/lib/query";

export const useDishes = () =>
  useQuery({
    queryKey: ["dishes"],
    queryFn: () =>
      db.query.dishes.findMany({
        with: {
          recipes: { with: { recipe: { with: { tags: { with: { tag: true } } } } }, orderBy: (dr, { asc }) => [asc(dr.position)] },
          meals: { columns: { mealId: true } },
        },
        orderBy: (d, { asc }) => [asc(d.name)],
      }),
  });

export type DishListItem = NonNullable<ReturnType<typeof useDishes>["data"]>[number];

export const getDish = (id: string) =>
  db.query.dishes.findFirst({
    where: eq(dishes.id, id),
    with: {
      recipes: { with: { recipe: { with: { tags: { with: { tag: true } } } } }, orderBy: (dr, { asc }) => [asc(dr.position)] },
      meals: { columns: { mealId: true } },
    },
  });

export const useDish = (id: string | undefined) => useQuery({ queryKey: ["dish", id], queryFn: () => getDish(id!), enabled: !!id });

export type DishInput = {
  id?: string;
  name: string;
  notes: string;
  /** Default coefficient of the recipes (each recipe keeps its own value). */
  coefficient?: number;
  /** In order; coefficient scales the recipe's quantities within the dish. */
  recipes: { recipeId: string; coefficient: number }[];
};

export async function saveDish(input: DishInput): Promise<string> {
  const { maxDishRecipes } = await getSettings();
  if (input.recipes.length === 0 || input.recipes.length === 1) throw new Error("Aggiungi almeno due ricette");
  if (input.recipes.length > maxDishRecipes) throw new Error(`Un piatto unico può avere al massimo ${maxDishRecipes} ricette`);
  if (new Set(input.recipes.map((r) => r.recipeId)).size !== input.recipes.length) throw new Error("Una ricetta può comparire una sola volta");

  const id = input.id ?? newId();
  const now = nowIso();
  const fields = { name: input.name.trim(), notes: input.notes.trim(), coefficient: input.coefficient ?? 1, updatedAt: now };
  await db.batch([
    input.id ? db.update(dishes).set(fields).where(eq(dishes.id, id)) : db.insert(dishes).values({ id, ...fields, createdAt: now }),
    db.delete(dishRecipes).where(eq(dishRecipes.dishId, id)),
    ...input.recipes.map((r, position) => db.insert(dishRecipes).values({ dishId: id, recipeId: r.recipeId, coefficient: r.coefficient, position })),
  ]);
  return id;
}

export const useSaveDish = () => useDbMutation(saveDish, { success: "Piatto unico salvato" });

/** Copies a dish (name + " (copia)") and returns the new id. */
export async function duplicateDish(id: string): Promise<string> {
  const d = await getDish(id);
  if (!d) throw new Error("Piatto unico non trovato");
  return saveDish({ name: `${d.name} (copia)`, notes: d.notes, coefficient: d.coefficient, recipes: d.recipes.map((r) => ({ recipeId: r.recipeId, coefficient: r.coefficient })) });
}

export const useDuplicateDish = () => useDbMutation(duplicateDish, { success: "Piatto unico duplicato" });

/** Names of the menus that use a dish. */
export async function mealsUsingDish(id: string): Promise<string[]> {
  const rows = await db.query.mealDishes.findMany({ where: eq(mealDishes.dishId, id), with: { meal: { columns: { name: true } } } });
  return rows.map((r) => r.meal.name);
}

export const useDeleteDish = () =>
  useDbMutation((id: string) => db.delete(dishes).where(eq(dishes.id, id)).run(), { success: "Piatto unico eliminato" });
