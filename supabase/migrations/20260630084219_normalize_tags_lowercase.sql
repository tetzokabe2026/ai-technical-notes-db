-- Normalize all existing tags to lowercase so tag search (cs operator) works consistently.
UPDATE technical_notes
SET tags = ARRAY(SELECT lower(t) FROM unnest(tags) t)
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
