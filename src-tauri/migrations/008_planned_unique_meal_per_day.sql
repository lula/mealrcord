-- A menu can be planned at most once per day.
CREATE UNIQUE INDEX planned_meals_unique_meal_day ON planned_meals (date, meal_id);
