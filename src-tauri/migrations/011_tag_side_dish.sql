-- System tag "Contorno" (side dish). It is not a menu course (course stays NULL).
-- A custom tag with the same name, if any, becomes the system one.
UPDATE tags SET is_system = 1 WHERE name = 'Contorno' COLLATE NOCASE AND is_system = 0;
INSERT INTO tags (id, name, is_system, course)
  SELECT 'tag-side', 'Contorno', 1, NULL
  WHERE NOT EXISTS (SELECT 1 FROM tags WHERE name = 'Contorno' COLLATE NOCASE);
