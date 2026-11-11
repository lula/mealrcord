-- Allergens (assigned to ingredients since 018). Seeded with the 14 EU allergens
-- (Reg. UE 1169/2011) except milk; all can be deleted and new ones added.
CREATE TABLE allergens (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE recipe_allergens (
  recipe_id   TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  allergen_id TEXT NOT NULL REFERENCES allergens (id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, allergen_id)
);
CREATE INDEX recipe_allergens_allergen ON recipe_allergens (allergen_id);

INSERT INTO allergens (id, name) VALUES
  ('allergen-gluten',    'Glutine'),
  ('allergen-crustacea', 'Crostacei'),
  ('allergen-eggs',      'Uova'),
  ('allergen-fish',      'Pesce'),
  ('allergen-peanuts',   'Arachidi'),
  ('allergen-soy',       'Soia'),
  ('allergen-nuts',      'Frutta a guscio'),
  ('allergen-celery',    'Sedano'),
  ('allergen-mustard',   'Senape'),
  ('allergen-sesame',    'Sesamo'),
  ('allergen-sulphites', 'Solfiti'),
  ('allergen-lupin',     'Lupini'),
  ('allergen-molluscs',  'Molluschi');
