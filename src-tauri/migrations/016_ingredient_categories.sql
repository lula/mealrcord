-- Ingredient categories (e.g. Verdura, Latticini). Each ingredient has zero or one.
CREATE TABLE ingredient_categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

ALTER TABLE ingredients ADD COLUMN category_id TEXT REFERENCES ingredient_categories (id) ON DELETE SET NULL;
CREATE INDEX ingredients_category ON ingredients (category_id);
