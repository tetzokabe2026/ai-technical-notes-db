ALTER TABLE categories
  ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN description TEXT,
  ADD COLUMN ai_generated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_name_key;

CREATE INDEX categories_parent_id_idx
  ON categories(parent_id);

CREATE UNIQUE INDEX categories_root_name_unique_idx
  ON categories(LOWER(name))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX categories_sibling_name_unique_idx
  ON categories(parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;
