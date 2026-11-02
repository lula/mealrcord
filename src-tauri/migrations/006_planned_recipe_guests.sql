-- Guests for one recipe of a planned meal (e.g. 15 of one main, 8 of another
-- for 20 guests). No row = the planned meal's guests.
CREATE TABLE planned_meal_recipe_guests (
  planned_meal_id TEXT NOT NULL REFERENCES planned_meals (id) ON DELETE CASCADE,
  recipe_id       TEXT NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
  guests          INTEGER NOT NULL CHECK (guests > 0),
  PRIMARY KEY (planned_meal_id, recipe_id)
);
