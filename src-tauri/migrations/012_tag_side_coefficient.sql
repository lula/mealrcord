-- Allow a per-course coefficient for side dishes ("side").
-- SQLite cannot change a CHECK constraint in place, so the table is rebuilt.
CREATE TABLE planned_meal_course_coefficients_new (
  planned_meal_id TEXT NOT NULL REFERENCES planned_meals (id) ON DELETE CASCADE,
  course          TEXT NOT NULL CHECK (course IN ('starter', 'first', 'main', 'side', 'dessert')),
  coefficient     REAL NOT NULL CHECK (coefficient > 0),
  PRIMARY KEY (planned_meal_id, course)
);
INSERT INTO planned_meal_course_coefficients_new (planned_meal_id, course, coefficient)
  SELECT planned_meal_id, course, coefficient FROM planned_meal_course_coefficients;
DROP TABLE planned_meal_course_coefficients;
ALTER TABLE planned_meal_course_coefficients_new RENAME TO planned_meal_course_coefficients;
