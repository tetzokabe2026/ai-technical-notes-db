CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE technical_notes
  ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

INSERT INTO categories (name)
SELECT DISTINCT TRIM(category)
FROM technical_notes
WHERE category IS NOT NULL
  AND TRIM(category) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE technical_notes
SET category_id = categories.id
FROM categories
WHERE technical_notes.category IS NOT NULL
  AND TRIM(technical_notes.category) = categories.name;

CREATE INDEX technical_notes_category_id_idx
  ON technical_notes(category_id);

ALTER TABLE technical_notes
  DROP COLUMN category;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE categories TO anon, authenticated;
