CREATE TABLE ai_classification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE note_ai_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ai_classification_runs(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES technical_notes(id) ON DELETE CASCADE,
  suggested_path TEXT[] NOT NULL,
  existing_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  confidence NUMERIC(4,3),
  reason TEXT,
  applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, note_id)
);

CREATE INDEX note_ai_classifications_run_id_idx
  ON note_ai_classifications(run_id);

CREATE INDEX note_ai_classifications_note_id_idx
  ON note_ai_classifications(note_id);

GRANT ALL ON TABLE ai_classification_runs TO service_role;
GRANT ALL ON TABLE note_ai_classifications TO service_role;
