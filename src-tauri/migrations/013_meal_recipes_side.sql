-- Allow side dishes ("side") as a menu course.
-- SQLite cannot change a CHECK constraint in place, so the table is rebuilt.
CREATE TABLE meal_recipes_new (
  meal_id   TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE RESTRICT,
  course    TEXT NOT NULL CHECK (course IN ('starter', 'first', 'main', 'side', 'dessert')),
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meal_id, recipe_id, course)
);
INSERT INTO meal_recipes_new (meal_id, recipe_id, course, position)
  SELECT meal_id, recipe_id, course, position FROM meal_recipes;
DROP TABLE meal_recipes;
ALTER TABLE meal_recipes_new RENAME TO meal_recipes;
CREATE INDEX meal_recipes_recipe ON meal_recipes (recipe_id);
CREATE UNIQUE INDEX meal_recipes_unique ON meal_recipes (meal_id, recipe_id);
