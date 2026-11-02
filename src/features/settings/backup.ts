import { invoke } from "@tauri-apps/api/core";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/** Every table as plain rows, for a human-readable export. */
export async function exportJson(path: string) {
  const data = {
    app: "mealrcord",
    exportedAt: new Date().toISOString(),
    units: await db.select().from(s.units),
    ingredients: await db.select().from(s.ingredients),
    tags: await db.select().from(s.tags),
    recipes: await db.select().from(s.recipes),
    recipeIngredients: await db.select().from(s.recipeIngredients),
    recipeSteps: await db.select().from(s.recipeSteps),
    recipeTags: await db.select().from(s.recipeTags),
    meals: await db.select().from(s.meals),
    mealRecipes: await db.select().from(s.mealRecipes),
    plannedMeals: await db.select().from(s.plannedMeals),
    plannedMealCourseCoefficients: await db.select().from(s.plannedMealCourseCoefficients),
  };
  await invoke("save_text_file", { path, contents: JSON.stringify(data, null, 2) });
}
