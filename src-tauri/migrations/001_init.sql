-- Units of measure. Units in the same dimension (mass, volume) convert
-- through factor_to_base (g for mass, ml for volume). 'other' never converts.
CREATE TABLE units (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  symbol         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  dimension      TEXT NOT NULL CHECK (dimension IN ('mass', 'volume', 'other')),
  factor_to_base REAL NOT NULL DEFAULT 1 CHECK (factor_to_base > 0),
  is_system      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ingredients (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  default_unit_id TEXT REFERENCES units (id) ON DELETE SET NULL
);

CREATE TABLE recipes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  base_servings INTEGER NOT NULL DEFAULT 4 CHECK (base_servings > 0),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE recipe_ingredients (
  recipe_id     TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients (id) ON DELETE RESTRICT,
  quantity      REAL NOT NULL CHECK (quantity >= 0),
  unit_id       TEXT NOT NULL REFERENCES units (id) ON DELETE RESTRICT,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (recipe_id, ingredient_id)
);
CREATE INDEX recipe_ingredients_ingredient ON recipe_ingredients (ingredient_id);

-- System tags map to a meal course and cannot be deleted.
CREATE TABLE tags (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  is_system INTEGER NOT NULL DEFAULT 0,
  course    TEXT CHECK (course IN ('starter', 'first', 'main', 'dessert'))
);

CREATE TABLE recipe_tags (
  recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);
CREATE INDEX recipe_tags_tag ON recipe_tags (tag_id);

CREATE TABLE meals (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  coefficient REAL NOT NULL DEFAULT 1 CHECK (coefficient > 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE meal_recipes (
  meal_id   TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL REFERENCES recipes (id) ON DELETE RESTRICT,
  course    TEXT NOT NULL CHECK (course IN ('starter', 'first', 'main', 'dessert')),
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meal_id, recipe_id, course)
);
CREATE INDEX meal_recipes_recipe ON meal_recipes (recipe_id);

-- A meal scheduled on a day, in a slot (e.g. Pranzo, Cena), for N guests.
CREATE TABLE planned_meals (
  id       TEXT PRIMARY KEY,
  date     TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  slot     TEXT NOT NULL DEFAULT 'Pranzo',
  meal_id  TEXT NOT NULL REFERENCES meals (id) ON DELETE RESTRICT,
  guests   INTEGER NOT NULL CHECK (guests > 0),
  notes    TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX planned_meals_date ON planned_meals (date);
CREATE INDEX planned_meals_meal ON planned_meals (meal_id);

CREATE TRIGGER tags_system_no_delete
BEFORE DELETE ON tags WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'I tag di sistema non possono essere eliminati');
END;

CREATE TRIGGER tags_system_no_update
BEFORE UPDATE ON tags WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'I tag di sistema non possono essere modificati');
END;

CREATE TRIGGER units_system_no_delete
BEFORE DELETE ON units WHEN OLD.is_system = 1
BEGIN
  SELECT RAISE(ABORT, 'Le unità di sistema non possono essere eliminate');
END;

INSERT INTO tags (id, name, is_system, course) VALUES
  ('tag-starter', 'Antipasto', 1, 'starter'),
  ('tag-first',   'Primo',     1, 'first'),
  ('tag-main',    'Secondo',   1, 'main'),
  ('tag-dessert', 'Dolce',     1, 'dessert');

INSERT INTO units (id, name, symbol, dimension, factor_to_base, is_system) VALUES
  ('unit-mg',   'milligrammi', 'mg',    'mass',   0.001, 1),
  ('unit-g',    'grammi',      'g',     'mass',   1,     1),
  ('unit-kg',   'chilogrammi', 'kg',    'mass',   1000,  1),
  ('unit-ml',   'millilitri',  'ml',    'volume', 1,     1),
  ('unit-cl',   'centilitri',  'cl',    'volume', 10,    1),
  ('unit-dl',   'decilitri',   'dl',    'volume', 100,   1),
  ('unit-l',    'litri',       'l',     'volume', 1000,  1),
  ('unit-tbsp', 'cucchiai',    'cucchiaio',   'volume', 15, 1),
  ('unit-tsp',  'cucchiaini',  'cucchiaino',  'volume', 5,  1),
  ('unit-pcs',  'pezzi',       'pz',    'other',  1,     1),
  ('unit-clove','spicchi',     'spicchio',    'other',  1, 1),
  ('unit-pinch','pizzichi',    'pizzico',     'other',  1, 1),
  ('unit-qb',   'quanto basta','q.b.',  'other',  1,     1);
