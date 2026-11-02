-- Quantity coefficient for one course of a meal. A missing row means the
-- course uses the meal's own coefficient.
CREATE TABLE meal_course_coefficients (
  meal_id     TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  course      TEXT NOT NULL CHECK (course IN ('starter', 'first', 'main', 'dessert')),
  coefficient REAL NOT NULL CHECK (coefficient > 0),
  PRIMARY KEY (meal_id, course)
);
