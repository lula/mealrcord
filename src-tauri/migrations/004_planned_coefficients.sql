-- The quantity coefficient belongs to a planned meal, not to the meal itself.
-- Each course of a planned meal can override it; no row = use the planned meal's.
ALTER TABLE planned_meals ADD COLUMN coefficient REAL NOT NULL DEFAULT 1 CHECK (coefficient > 0);
UPDATE planned_meals SET coefficient = (SELECT m.coefficient FROM meals m WHERE m.id = planned_meals.meal_id);

CREATE TABLE planned_meal_course_coefficients (
  planned_meal_id TEXT NOT NULL REFERENCES planned_meals (id) ON DELETE CASCADE,
  course          TEXT NOT NULL CHECK (course IN ('starter', 'first', 'main', 'dessert')),
  coefficient     REAL NOT NULL CHECK (coefficient > 0),
  PRIMARY KEY (planned_meal_id, course)
);
INSERT INTO planned_meal_course_coefficients (planned_meal_id, course, coefficient)
  SELECT p.id, c.course, c.coefficient
  FROM planned_meals p JOIN meal_course_coefficients c ON c.meal_id = p.meal_id;

DROP TABLE meal_course_coefficients;
ALTER TABLE meals DROP COLUMN coefficient;
