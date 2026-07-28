ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_users_auth_user_id_idx ON app_users(auth_user_id);
