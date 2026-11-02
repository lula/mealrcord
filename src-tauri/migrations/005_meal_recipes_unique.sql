-- A recipe can appear only once in a menu. Existing duplicates keep the
-- earliest course (starter, first, main, dessert).
DELETE FROM meal_recipes
WHERE EXISTS (
  SELECT 1 FROM meal_recipes o
  WHERE o.meal_id = meal_recipes.meal_id
    AND o.recipe_id = meal_recipes.recipe_id
    AND CASE o.course WHEN 'starter' THEN 0 WHEN 'first' THEN 1 WHEN 'main' THEN 2 ELSE 3 END
      < CASE meal_recipes.course WHEN 'starter' THEN 0 WHEN 'first' THEN 1 WHEN 'main' THEN 2 ELSE 3 END
);
CREATE UNIQUE INDEX meal_recipes_unique ON meal_recipes (meal_id, recipe_id);
