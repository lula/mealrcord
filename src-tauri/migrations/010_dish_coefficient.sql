-- Default coefficient of a "piatto unico": presets the coefficient of its recipes.
ALTER TABLE dishes ADD COLUMN coefficient REAL NOT NULL DEFAULT 1 CHECK (coefficient > 0);
