ALTER TABLE technical_notes
  DROP COLUMN IF EXISTS rating_reality,
  DROP COLUMN IF EXISTS rating_sensitive;
