ALTER TABLE ai_classification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_ai_classifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE ai_classification_runs FROM anon, authenticated;
REVOKE ALL ON TABLE note_ai_classifications FROM anon, authenticated;

GRANT ALL ON TABLE ai_classification_runs TO service_role;
GRANT ALL ON TABLE note_ai_classifications TO service_role;
