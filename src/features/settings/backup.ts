import { invoke } from "@tauri-apps/api/core";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Every table as plain rows, for a human-readable export. */
export async function exportJson(path: string) {
  const data = {
    app: "mealrcord",
    exportedAt: new Date().toISOString(),
    units: await db.select().from(s.units),
    ingredientCategories: await db.select().from(s.ingredientCategories),
    ingredients: await db.select().from(s.ingredients),
    ingredientAllergens: await db.select().from(s.ingredientAllergens),
    tags: await db.select().from(s.tags),
    allergens: await db.select().from(s.allergens),
    recipes: await db.select().from(s.recipes),
    recipeIngredients: await db.select().from(s.recipeIngredients),
    recipeTags: await db.select().from(s.recipeTags),
    meals: await db.select().from(s.meals),
    mealRecipes: await db.select().from(s.mealRecipes),
    dishes: await db.select().from(s.dishes),
    dishRecipes: await db.select().from(s.dishRecipes),
    mealDishes: await db.select().from(s.mealDishes),
    plannedMeals: await db.select().from(s.plannedMeals),
    plannedMealCourseCoefficients: await db.select().from(s.plannedMealCourseCoefficients),
    plannedMealRecipeGuests: await db.select().from(s.plannedMealRecipeGuests),
    plannedMealDishGuests: await db.select().from(s.plannedMealDishGuests),
    settings: await db.select().from(s.settings),
  };
  await invoke("save_text_file", { path, contents: JSON.stringify(data, null, 2) });
}
