// Mirrors src-tauri/migrations/*.sql. Keep the two in sync.
import { relations } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const COURSES = ["starter", "first", "main", "side", "dessert"] as const;
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

/** Ingredient categories (e.g. Verdura, Latticini). */
export const ingredientCategories = sqliteTable("ingredient_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const ingredients = sqliteTable("ingredients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  defaultUnitId: text("default_unit_id").references(() => units.id),
  /** Zero or one category; cleared when the category is deleted. */
  categoryId: text("category_id").references(() => ingredientCategories.id),
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
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    quantity: real("quantity").notNull(),
    unitId: text("unit_id")
      .notNull()
      .references(() => units.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.ingredientId] })],
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
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] })],
);

/** Allergens (e.g. Glutine, Sedano). Assigned to ingredients; a recipe has those of its ingredients. */
export const allergens = sqliteTable("allergens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const ingredientAllergens = sqliteTable(
  "ingredient_allergens",
  {
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    allergenId: text("allergen_id")
      .notNull()
      .references(() => allergens.id),
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.allergenId] })],
);

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mealRecipes = sqliteTable(
  "meal_recipes",
  {
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    course: text("course", { enum: COURSES }).notNull(),
    position: integer("position").notNull().default(0),
  },
  // A recipe appears once per menu.
  (t) => [primaryKey({ columns: [t.mealId, t.recipeId, t.course] }), uniqueIndex("meal_recipes_unique").on(t.mealId, t.recipeId)],
);

/** "Piatto unico": up to N recipes served in the same dish. */
export const dishes = sqliteTable("dishes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes").notNull().default(""),
  /** Presets the coefficient of the dish's recipes. */
  coefficient: real("coefficient").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** A recipe of a dish, with its quantity coefficient within the dish. */
export const dishRecipes = sqliteTable(
  "dish_recipes",
  {
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    coefficient: real("coefficient").notNull().default(1),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.dishId, t.recipeId] })],
);

/** Dishes of a menu, in order. */
export const mealDishes = sqliteTable(
  "meal_dishes",
  {
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.mealId, t.dishId] })],
);

export const plannedMeals = sqliteTable(
  "planned_meals",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // yyyy-MM-dd
    slot: text("slot").notNull().default("Pranzo"),
    mealId: text("meal_id")
      .notNull()
      .references(() => meals.id),
    guests: integer("guests").notNull(),
    /** Coefficient of the menu's dishes; null = 1. */
    dishCoefficient: real("dish_coefficient"),
    notes: text("notes").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  // A menu is planned at most once per day.
  (t) => [uniqueIndex("planned_meals_unique_meal_day").on(t.date, t.mealId)],
);

/** Per-course quantity coefficient. No row = 1. */
export const plannedMealCourseCoefficients = sqliteTable(
  "planned_meal_course_coefficients",
  {
    plannedMealId: text("planned_meal_id")
      .notNull()
      .references(() => plannedMeals.id),
    course: text("course", { enum: COURSES }).notNull(),
    coefficient: real("coefficient").notNull(),
  },
  (t) => [primaryKey({ columns: [t.plannedMealId, t.course] })],
);

/** Per-recipe override of the planned meal guests. No row = use the planned meal's. */
export const plannedMealRecipeGuests = sqliteTable(
  "planned_meal_recipe_guests",
  {
    plannedMealId: text("planned_meal_id")
      .notNull()
      .references(() => plannedMeals.id),
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id),
    guests: integer("guests").notNull(),
  },
  (t) => [primaryKey({ columns: [t.plannedMealId, t.recipeId] })],
);

/** Per-dish override of the planned meal guests. No row = even split among the dishes. */
export const plannedMealDishGuests = sqliteTable(
  "planned_meal_dish_guests",
  {
    plannedMealId: text("planned_meal_id")
      .notNull()
      .references(() => plannedMeals.id),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    guests: integer("guests").notNull(),
  },
  (t) => [primaryKey({ columns: [t.plannedMealId, t.dishId] })],
);

/** App preferences; values are JSON (see features/settings/api.ts). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const unitsRelations = relations(units, () => ({}));

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  defaultUnit: one(units, { fields: [ingredients.defaultUnitId], references: [units.id] }),
  category: one(ingredientCategories, { fields: [ingredients.categoryId], references: [ingredientCategories.id] }),
  recipeIngredients: many(recipeIngredients),
  allergens: many(ingredientAllergens),
}));

export const ingredientCategoriesRelations = relations(ingredientCategories, ({ many }) => ({
  ingredients: many(ingredients),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  dishRecipes: many(dishRecipes),
  ingredients: many(recipeIngredients),
  tags: many(recipeTags),
  mealRecipes: many(mealRecipes),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
  ingredient: one(ingredients, { fields: [recipeIngredients.ingredientId], references: [ingredients.id] }),
  unit: one(units, { fields: [recipeIngredients.unitId], references: [units.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipes: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeTags.recipeId], references: [recipes.id] }),
  tag: one(tags, { fields: [recipeTags.tagId], references: [tags.id] }),
}));

export const allergensRelations = relations(allergens, ({ many }) => ({
  ingredients: many(ingredientAllergens),
}));

export const ingredientAllergensRelations = relations(ingredientAllergens, ({ one }) => ({
  ingredient: one(ingredients, { fields: [ingredientAllergens.ingredientId], references: [ingredients.id] }),
  allergen: one(allergens, { fields: [ingredientAllergens.allergenId], references: [allergens.id] }),
}));

export const mealsRelations = relations(meals, ({ many }) => ({
  recipes: many(mealRecipes),
  dishes: many(mealDishes),
  planned: many(plannedMeals),
}));

export const dishesRelations = relations(dishes, ({ many }) => ({
  recipes: many(dishRecipes),
  meals: many(mealDishes),
}));

export const dishRecipesRelations = relations(dishRecipes, ({ one }) => ({
  dish: one(dishes, { fields: [dishRecipes.dishId], references: [dishes.id] }),
  recipe: one(recipes, { fields: [dishRecipes.recipeId], references: [recipes.id] }),
}));

export const mealDishesRelations = relations(mealDishes, ({ one }) => ({
  meal: one(meals, { fields: [mealDishes.mealId], references: [meals.id] }),
  dish: one(dishes, { fields: [mealDishes.dishId], references: [dishes.id] }),
}));

export const mealRecipesRelations = relations(mealRecipes, ({ one }) => ({
  meal: one(meals, { fields: [mealRecipes.mealId], references: [meals.id] }),
  recipe: one(recipes, { fields: [mealRecipes.recipeId], references: [recipes.id] }),
}));

export const plannedMealsRelations = relations(plannedMeals, ({ one, many }) => ({
  meal: one(meals, { fields: [plannedMeals.mealId], references: [meals.id] }),
  courseCoefficients: many(plannedMealCourseCoefficients),
  recipeGuests: many(plannedMealRecipeGuests),
  dishGuests: many(plannedMealDishGuests),
}));

export const plannedMealDishGuestsRelations = relations(plannedMealDishGuests, ({ one }) => ({
  plannedMeal: one(plannedMeals, { fields: [plannedMealDishGuests.plannedMealId], references: [plannedMeals.id] }),
}));

export const plannedMealRecipeGuestsRelations = relations(plannedMealRecipeGuests, ({ one }) => ({
  plannedMeal: one(plannedMeals, { fields: [plannedMealRecipeGuests.plannedMealId], references: [plannedMeals.id] }),
}));

export const plannedMealCourseCoefficientsRelations = relations(plannedMealCourseCoefficients, ({ one }) => ({
  plannedMeal: one(plannedMeals, { fields: [plannedMealCourseCoefficients.plannedMealId], references: [plannedMeals.id] }),
}));

export type Unit = typeof units.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type IngredientCategory = typeof ingredientCategories.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Allergen = typeof allergens.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type Dish = typeof dishes.$inferSelect;
export type PlannedMeal = typeof plannedMeals.$inferSelect;
