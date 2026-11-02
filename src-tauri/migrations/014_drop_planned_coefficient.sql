-- Remove the planned meal's quantity coefficient: courses and "piatti unici"
-- without their own coefficient now use 1. To keep existing quantities, the
-- old value moves to every course and dish group that relied on it.
INSERT INTO planned_meal_course_coefficients (planned_meal_id, course, coefficient)
  SELECT DISTINCT p.id, mr.course, p.coefficient
  FROM planned_meals p JOIN meal_recipes mr ON mr.meal_id = p.meal_id
  WHERE p.coefficient <> 1
    AND NOT EXISTS (
      SELECT 1 FROM planned_meal_course_coefficients c
      WHERE c.planned_meal_id = p.id AND c.course = mr.course
    );
UPDATE planned_meals SET dish_coefficient = coefficient
  WHERE dish_coefficient IS NULL
    AND coefficient <> 1
    AND EXISTS (SELECT 1 FROM meal_dishes md WHERE md.meal_id = planned_meals.meal_id);
ALTER TABLE planned_meals DROP COLUMN coefficient;
