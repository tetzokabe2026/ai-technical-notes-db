CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id TEXT UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  setup_token_hash TEXT UNIQUE,
  setup_token_expires_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_mfa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE technical_notes
  ADD COLUMN owner_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE categories
  ADD COLUMN owner_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

ALTER TABLE ai_classification_runs
  ADD COLUMN owner_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;

CREATE INDEX app_users_status_idx ON app_users(status);
CREATE INDEX app_users_role_idx ON app_users(role);
CREATE INDEX app_mfa_challenges_user_id_idx ON app_mfa_challenges(user_id);
CREATE INDEX app_sessions_user_id_idx ON app_sessions(user_id);
CREATE INDEX technical_notes_owner_user_id_idx ON technical_notes(owner_user_id);
CREATE INDEX categories_owner_user_id_idx ON categories(owner_user_id);
CREATE INDEX ai_classification_runs_owner_user_id_idx ON ai_classification_runs(owner_user_id);

DROP INDEX IF EXISTS categories_root_name_unique_idx;
DROP INDEX IF EXISTS categories_sibling_name_unique_idx;

CREATE UNIQUE INDEX categories_owner_root_name_unique_idx
  ON categories(owner_user_id, LOWER(name))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX categories_owner_sibling_name_unique_idx
  ON categories(owner_user_id, parent_id, LOWER(name))
  WHERE parent_id IS NOT NULL;

REVOKE ALL ON TABLE technical_notes FROM anon, authenticated;
REVOKE ALL ON TABLE categories FROM anon, authenticated;
REVOKE ALL ON TABLE app_users FROM anon, authenticated;
REVOKE ALL ON TABLE app_mfa_challenges FROM anon, authenticated;
REVOKE ALL ON TABLE app_sessions FROM anon, authenticated;

GRANT ALL ON TABLE app_users TO service_role;
GRANT ALL ON TABLE app_mfa_challenges TO service_role;
GRANT ALL ON TABLE app_sessions TO service_role;
GRANT ALL ON TABLE technical_notes TO service_role;
GRANT ALL ON TABLE categories TO service_role;

ALTER TABLE technical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
