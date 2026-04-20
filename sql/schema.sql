-- ============================================================
--  SESMag HR Portal — Neon PostgreSQL Schema
--  Run this once in your Neon SQL Editor:
--  https://console.neon.tech → your project → SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username        VARCHAR(60)  NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   TEXT         NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'employee'
                    CHECK (role IN ('employee','manager','admin')),
  first_name      VARCHAR(80)  NOT NULL,
  last_name       VARCHAR(80)  NOT NULL,
  pronouns        VARCHAR(40),
  phone           VARCHAR(30),
  bio             TEXT,
  department      VARCHAR(100),
  job_title       VARCHAR(100),
  hire_date       DATE,
  manager_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  -- SESMag accessibility preferences
  font_size_pref       VARCHAR(10) NOT NULL DEFAULT 'medium'
                         CHECK (font_size_pref IN ('small','medium','large','xlarge')),
  color_theme          VARCHAR(20) NOT NULL DEFAULT 'light'
                         CHECK (color_theme IN ('light','dark','high-contrast','sepia')),
  reduce_motion        BOOLEAN NOT NULL DEFAULT FALSE,
  screen_reader_mode   BOOLEAN NOT NULL DEFAULT FALSE,
  tech_comfort_level   SMALLINT NOT NULL DEFAULT 3
                         CHECK (tech_comfort_level BETWEEN 1 AND 5),
  preferred_language   VARCHAR(10) NOT NULL DEFAULT 'en',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROFILE CHANGE LOG ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_changes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by  TEXT NOT NULL REFERENCES users(id),
  field_name  VARCHAR(100) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CHAT HISTORY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── AUTO-UPDATE updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_manager   ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_changes_user    ON profile_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_time  ON chat_messages(user_id, created_at DESC);

-- ============================================================
--  SEED DATA — paste this after the schema above
-- ============================================================

-- NOTE: passwords are bcrypt of 'Password1!'
-- Generate fresh hashes: node -e "const b=require('bcryptjs');b.hash('Password1!',12).then(console.log)"

INSERT INTO users (
  id, username, email, password_hash, role,
  first_name, last_name, pronouns, department, job_title, hire_date,
  bio, phone, font_size_pref, color_theme, reduce_motion,
  screen_reader_mode, tech_comfort_level
) VALUES
('u-admin-001','admin','admin@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'admin','System','Admin',NULL,'Operations','System Administrator','2020-01-01',
 'Platform administrator.', '+1-555-000-0001','medium','dark',false,false,5),

('u-mgr-001','patricia_m','patricia@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'manager','Patricia','Martinez','she/her','Engineering','Engineering Manager','2021-03-15',
 'Experienced engineering leader. Loves automating everything.',
 '+1-555-100-0002','medium','dark',false,false,5),

('u-dav-001','dav_persona','dav@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'employee','DAV','Persona','they/them','Customer Success','Support Specialist','2023-06-01',
 'Represents underserved SESMag persona. Prefers clear language and larger text.',
 '+1-555-200-0003','xlarge','high-contrast',true,false,2),

('u-tim-001','tim_c','tim@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'employee','Tim','Chen','he/him','Operations','Logistics Coordinator','2022-09-10',
 'Primarily mobile user. Values fast load times.',
 '+1-555-300-0004','large','light',false,false,2),

('u-abi-001','abi_k','abi@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'employee','Abi','Khan','she/her','Product & Design','UX Researcher','2022-01-20',
 'Screen reader user. Advocates for accessibility and inclusive design.',
 '+1-555-400-0005','medium','high-contrast',true,true,3),

('u-gary-001','gary_w','gary@sesmag.org',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/VqfzFj2',
 'employee','Gary','Williams','he/him','Human Resources','HR Generalist','2019-07-01',
 'Prefers telephone calls over email. Learning digital systems.',
 '+1-555-500-0006','xlarge','light',true,false,1)
ON CONFLICT (username) DO NOTHING;

-- Set manager relationships
UPDATE users SET manager_id = 'u-mgr-001'
WHERE username IN ('dav_persona','tim_c','abi_k','gary_w');

-- ── SYSTEM LOGS ───────────────────────────────────────────────
-- Run this block in Neon SQL Editor to add logging support
CREATE TABLE IF NOT EXISTS system_logs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  level       VARCHAR(10)  NOT NULL CHECK (level IN ('info','warn','error','debug')),
  category    VARCHAR(50)  NOT NULL, -- 'auth', 'user', 'api', 'db', 'middleware'
  action      VARCHAR(100) NOT NULL, -- e.g. 'login_success', 'profile_update'
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  username    VARCHAR(60),
  ip          VARCHAR(60),
  path        VARCHAR(255),
  method      VARCHAR(10),
  status_code INT,
  message     TEXT,
  metadata    JSONB,
  duration_ms INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_created  ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level    ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_user     ON system_logs(user_id);
