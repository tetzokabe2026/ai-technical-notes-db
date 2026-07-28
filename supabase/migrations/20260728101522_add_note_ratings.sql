ALTER TABLE technical_notes
  ADD COLUMN rating_eval_id text,
  ADD COLUMN rating_usefulness smallint,
  ADD COLUMN rating_importance smallint,
  ADD COLUMN rating_credibility smallint;
