// Mirrors src-tauri/migrations/*.sql. Keep the two in sync.
import { relations } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const COURSES = ["starter", "first", "main", "dessert"] as const;
export type Course = (typeof COURSES)[number];

export const DIMENSIONS = ["mass", "volume", "other"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  dimension: text("dimension", { enum: DIMENSIONS }).notNull(),
  factorToBase: real("factor_to_base").notNull().default(1),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
});

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  defaultUnitId: text("default_unit_id").references(() => units.id),
});

export const recipes = sqliteTable("recipes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  baseServings: integer("base_servings").notNull().default(2),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    recipeId: text("recipe_id").notNull().references(() => recipes.id),
    ingredientId: text("ingredient_id").notNull().references(() => ingredients.id),
    quantity: real("quantity").notNull(),
    unitId: text("unit_id").notNull().references(() => units.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.ingredientId] })],
);

export const recipeSteps = sqliteTable(
  "recipe_steps",
  {
    recipeId: text("recipe_id").notNull().references(() => recipes.id),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.position] })],
);

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  course: text("course", { enum: COURSES }),
});

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id").notNull().references(() => recipes.id),
    tagId: text("tag_id").notNull().references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] })],
);

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes").notNull().default(""),
  coefficient: real("coefficient").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mealRecipes = sqliteTable(
  "meal_recipes",
  {
    mealId: text("meal_id").notNull().references(() => meals.id),
    recipeId: text("recipe_id").notNull().references(() => recipes.id),
    course: text("course", { enum: COURSES }).notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.mealId, t.recipeId, t.course] })],
);

/** Per-course override of the meal coefficient. No row = use the meal's. */
export const mealCourseCoefficients = sqliteTable(
  "meal_course_coefficients",
  {
    mealId: text("meal_id").notNull().references(() => meals.id),
    course: text("course", { enum: COURSES }).notNull(),
    coefficient: real("coefficient").notNull(),
  },
  (t) => [primaryKey({ columns: [t.mealId, t.course] })],
);

export const plannedMeals = sqliteTable("planned_meals", {
  id: text("id").primaryKey(),
  date: text("date").notNull(), // yyyy-MM-dd
  slot: text("slot").notNull().default("Pranzo"),
  mealId: text("meal_id").notNull().references(() => meals.id),
  guests: integer("guests").notNull(),
  notes: text("notes").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export const unitsRelations = relations(units, () => ({}));

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  defaultUnit: one(units, { fields: [ingredients.defaultUnitId], references: [units.id] }),
  recipeIngredients: many(recipeIngredients),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
  steps: many(recipeSteps),
  tags: many(recipeTags),
  mealRecipes: many(mealRecipes),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
  ingredient: one(ingredients, { fields: [recipeIngredients.ingredientId], references: [ingredients.id] }),
  unit: one(units, { fields: [recipeIngredients.unitId], references: [units.id] }),
}));

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeSteps.recipeId], references: [recipes.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipes: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeTags.recipeId], references: [recipes.id] }),
  tag: one(tags, { fields: [recipeTags.tagId], references: [tags.id] }),
}));

export const mealsRelations = relations(meals, ({ many }) => ({
  recipes: many(mealRecipes),
  courseCoefficients: many(mealCourseCoefficients),
  planned: many(plannedMeals),
}));

export const mealCourseCoefficientsRelations = relations(mealCourseCoefficients, ({ one }) => ({
  meal: one(meals, { fields: [mealCourseCoefficients.mealId], references: [meals.id] }),
}));

export const mealRecipesRelations = relations(mealRecipes, ({ one }) => ({
  meal: one(meals, { fields: [mealRecipes.mealId], references: [meals.id] }),
  recipe: one(recipes, { fields: [mealRecipes.recipeId], references: [recipes.id] }),
}));

export const plannedMealsRelations = relations(plannedMeals, ({ one }) => ({
  meal: one(meals, { fields: [plannedMeals.mealId], references: [meals.id] }),
}));

export type Unit = typeof units.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type PlannedMeal = typeof plannedMeals.$inferSelect;
