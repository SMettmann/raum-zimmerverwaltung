PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','manager','staff','cleaning','viewer')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_state (
  org_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  pair_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_pair ON login_attempts(pair_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at);
