-- "Piatti unici": up to N recipes served in the same dish, each with its own
-- quantity coefficient. Kept in their own catalog and added to menus.
CREATE TABLE dishes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE dish_recipes (
  dish_id     TEXT NOT NULL REFERENCES dishes (id) ON DELETE CASCADE,
  recipe_id   TEXT NOT NULL REFERENCES recipes (id) ON DELETE RESTRICT,
  coefficient REAL NOT NULL DEFAULT 1 CHECK (coefficient > 0),
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, recipe_id)
);
CREATE INDEX dish_recipes_recipe ON dish_recipes (recipe_id);

CREATE TABLE meal_dishes (
  meal_id  TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  dish_id  TEXT NOT NULL REFERENCES dishes (id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (meal_id, dish_id)
);
CREATE INDEX meal_dishes_dish ON meal_dishes (dish_id);

-- In the planner the dishes of a menu form one group: its coefficient
-- (NULL = the planned meal's) and guests per dish (no row = even split).
ALTER TABLE planned_meals ADD COLUMN dish_coefficient REAL CHECK (dish_coefficient > 0);

CREATE TABLE planned_meal_dish_guests (
  planned_meal_id TEXT NOT NULL REFERENCES planned_meals (id) ON DELETE CASCADE,
  dish_id         TEXT NOT NULL REFERENCES dishes (id) ON DELETE CASCADE,
  guests          INTEGER NOT NULL CHECK (guests > 0),
  PRIMARY KEY (planned_meal_id, dish_id)
);
