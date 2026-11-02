-- Ordered preparation steps of a recipe.
CREATE TABLE recipe_steps (
  recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  text      TEXT NOT NULL,
  PRIMARY KEY (recipe_id, position)
);
