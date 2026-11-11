-- Allergens belong to ingredients, not recipes: a recipe's allergens are the
-- union of its ingredients' allergens.
CREATE TABLE ingredient_allergens (
  ingredient_id TEXT NOT NULL REFERENCES ingredients (id) ON DELETE CASCADE,
  allergen_id   TEXT NOT NULL REFERENCES allergens (id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_id)
);
CREATE INDEX ingredient_allergens_allergen ON ingredient_allergens (allergen_id);

DROP TABLE recipe_allergens;

DELETE FROM allergens where id IN ('allergen-eggs', 'allergen-fish');