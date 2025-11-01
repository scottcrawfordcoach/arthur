-- ============================================================
--  SCOTT-ASSISTANT  LOCAL  DATABASE  SCHEMA
--  (SQLite version – mirrors Supabase tables & adds AI modules)
-- ============================================================

PRAGMA foreign_keys = OFF;

-- ==========  CORE USER / PROFILE  ==========

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  external_key TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  tz TEXT DEFAULT 'UTC'
);

CREATE TABLE user_prefs (
  user_id TEXT PRIMARY KEY,
  profile TEXT DEFAULT '{}',
  preferences TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profile_mode (
  user_id TEXT,
  mode TEXT,
  system_prompt TEXT,
  preferences TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, mode)
);

-- ==========  JOURNALING / LOGGING  ==========

CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  type TEXT,
  content TEXT,
  parsed_data TEXT DEFAULT '{}',
  category TEXT,
  metadata TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  content TEXT,
  mode TEXT DEFAULT 'journal',
  type TEXT,
  tags TEXT,
  parsed_data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  mode TEXT DEFAULT 'journal',
  kind TEXT,
  content TEXT,
  tags TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT
);

CREATE TABLE user_domain_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  domain TEXT,
  note TEXT,
  tags TEXT,
  source TEXT DEFAULT 'nlp',
  inferred INTEGER DEFAULT 0,
  context TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========  GOALS / HABITS  ==========

CREATE TABLE user_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  goal_text TEXT,
  goal_type TEXT,
  category TEXT,
  parent_goal_id TEXT,
  chunked_goal INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  due_date TEXT,
  title TEXT,
  why TEXT,
  domain TEXT,
  metric_name TEXT,
  baseline REAL,
  target REAL,
  units TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE goal_habits (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  name TEXT,
  cadence TEXT,
  target_freq INTEGER,
  notes TEXT,
  rule_phrases TEXT,
  updated_at TEXT
);

CREATE TABLE goal_progress (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  progress_text TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goal_periods (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  week_start TEXT,
  week_end TEXT,
  target_freq_sum INTEGER,
  actual_freq_sum INTEGER,
  adherence_pct REAL,
  status TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========  WELLNESS / HEALTH DATA  ==========

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  activity_type TEXT,
  source TEXT DEFAULT 'import',
  name TEXT,
  started_at TEXT,
  ended_at TEXT,
  mood TEXT,
  tags TEXT,
  distance_m REAL,
  avg_hr REAL,
  max_hr REAL,
  calories_kcal REAL,
  weather TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sleep_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  date TEXT,
  start_at TEXT,
  end_at TEXT,
  duration_min INTEGER,
  score INTEGER,
  hr_avg_bpm INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nutrition_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  source TEXT,
  description TEXT,
  items TEXT,
  totals TEXT,
  status TEXT DEFAULT 'draft'
);

CREATE TABLE wellness_daily (
  user_id TEXT,
  date TEXT,
  steps INTEGER,
  calories_total_kcal INTEGER,
  stress_avg INTEGER,
  vo2max_running REAL,
  weight_kg REAL,
  bmi REAL,
  hydration_ml INTEGER,
  PRIMARY KEY (user_id, date)
);

-- ==========  REFERENCE / WRITING LIBRARY  ==========

CREATE TABLE reference_library_documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  summary TEXT,
  category TEXT,
  tags TEXT,
  writing_type TEXT,
  original_filename TEXT,
  storage_path TEXT,
  date_added TEXT DEFAULT CURRENT_TIMESTAMP,
  chunk_count INTEGER DEFAULT 0,
  embedding_status TEXT DEFAULT 'summary_only'
);

CREATE TABLE reference_library_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  chunk_index INTEGER,
  content TEXT,
  summary TEXT,
  section_title TEXT,
  category TEXT,
  embedding TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voice_resources (
  id TEXT PRIMARY KEY,
  source_type TEXT,
  title TEXT,
  tags TEXT,
  content TEXT,
  weight INTEGER DEFAULT 50,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========  ASSISTANT EXTENSIONS  ==========

CREATE TABLE assistant_files (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  file_path TEXT,
  source_bucket TEXT,
  file_type TEXT,
  original_name TEXT,
  file_hash TEXT, -- SHA256 hash for duplicate detection
  tags TEXT,
  processed_at TEXT,
  conversion_status TEXT DEFAULT 'pending',
  metadata TEXT,
  embedding_status TEXT DEFAULT 'unprocessed',
  knowledge_tier TEXT DEFAULT 'reference_library' -- core_knowledge | personal_journal | reference_library | archive
);

CREATE TABLE assistant_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  chunk_index INTEGER,
  content TEXT,
  summary TEXT,
  embedding TEXT,
  tags TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistant_chat_sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  summary TEXT,
  embedding TEXT
);

CREATE TABLE assistant_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  embedding TEXT
);

CREATE TABLE assistant_preferences (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE,
  value TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistant_project_buckets (
  id TEXT PRIMARY KEY,
  slot INTEGER UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  active_file_count INTEGER DEFAULT 0
);

CREATE TABLE assistant_project_bucket_files (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  stored_path TEXT,
  converted_path TEXT,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bucket_id) REFERENCES assistant_project_buckets(id),
  FOREIGN KEY (file_id) REFERENCES assistant_files(id)
);

CREATE TABLE assistant_session_context (
  session_id TEXT PRIMARY KEY,
  active_bucket_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES assistant_chat_sessions(id),
  FOREIGN KEY (active_bucket_id) REFERENCES assistant_project_buckets(id)
);

CREATE TABLE assistant_embeddings (
  id TEXT PRIMARY KEY,
  source_table TEXT,
  source_id TEXT,
  embedding TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistant_relations (
  source_id TEXT,
  target_id TEXT,
  relation_type TEXT,
  weight REAL
);

CREATE TABLE assistant_archive (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  summary TEXT,
  archived_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistant_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT,
  status TEXT DEFAULT 'pending',
  payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- ==========  POLICY LEARNING & ADAPTATION  ==========

CREATE TABLE assistant_user_preferences (
  user_id TEXT PRIMARY KEY DEFAULT 'default',
  policy_overrides TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assistant_policy_feedback_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT DEFAULT 'default',
  feedback_type TEXT,
  adjustment TEXT,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========  WELLNESS & JOURNAL TRACKING (ScottBot)  ==========

CREATE TABLE wellness_daily (
  user_id TEXT NOT NULL DEFAULT 'default',
  date TEXT NOT NULL,
  steps INTEGER,
  floors INTEGER,
  resting_hr INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  calories_total_kcal INTEGER,
  calories_active_kcal INTEGER,
  calories_resting_kcal INTEGER,
  stress_avg INTEGER,
  stress_max INTEGER,
  body_battery_min INTEGER,
  body_battery_max INTEGER,
  body_battery_change INTEGER,
  intensity_min_mod INTEGER,
  intensity_min_vig INTEGER,
  respiration_rate_avg REAL,
  spo2_avg REAL,
  spo2_min REAL,
  spo2_time_below90_min INTEGER,
  vo2max_running REAL,
  vo2max_cycling REAL,
  weight_kg REAL,
  bmi REAL,
  temp_mean_c REAL,
  temp_min_c REAL,
  temp_max_c REAL,
  source TEXT DEFAULT 'manual',
  raw TEXT, -- JSON
  protein_total_g INTEGER,
  carbs_total_g INTEGER,
  fat_total_g INTEGER,
  hydration_ml INTEGER,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE sleep_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL DEFAULT 'default',
  date TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  duration_min INTEGER,
  efficiency INTEGER,
  score INTEGER,
  latency_min INTEGER,
  awakenings INTEGER,
  light_min INTEGER,
  deep_min INTEGER,
  rem_min INTEGER,
  awake_min INTEGER,
  respiration_rate_avg REAL,
  spo2_avg REAL,
  hr_min_bpm INTEGER,
  hr_avg_bpm INTEGER,
  quality_label TEXT,
  factors TEXT, -- JSON
  source TEXT DEFAULT 'manual',
  raw TEXT, -- JSON
  is_nap INTEGER DEFAULT 0,
  sleep_window_confirmation_type TEXT,
  restless_moment_count INTEGER,
  avg_sleep_stress REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL DEFAULT 'default',
  activity_type TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  name TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  is_outdoor INTEGER,
  user_comment TEXT,
  rpe INTEGER, -- Rate of Perceived Exertion (1-10)
  mood TEXT, -- Qualitative mood assessment
  tags TEXT, -- JSON array
  surface TEXT,
  equipment TEXT, -- JSON
  custom TEXT, -- JSON
  elapsed_time_s INTEGER,
  moving_time_s INTEGER,
  distance_m INTEGER,
  total_ascent_m INTEGER,
  total_descent_m INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  avg_power INTEGER,
  max_power INTEGER,
  avg_cadence INTEGER,
  max_cadence INTEGER,
  avg_speed_mps REAL,
  max_speed_mps REAL,
  calories_kcal INTEGER,
  local_date TEXT,
  week_start_local TEXT,
  tz_used TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL DEFAULT 'default',
  entry_date TEXT NOT NULL,
  entry_type TEXT DEFAULT 'general', -- general, gratitude, reflection, goal, etc.
  content TEXT NOT NULL,
  mood TEXT, -- Overall mood rating or description
  energy_level INTEGER, -- 1-10 scale
  stress_level INTEGER, -- 1-10 scale
  tags TEXT, -- JSON array
  linked_activity_id TEXT, -- FK to activities
  linked_sleep_id TEXT, -- FK to sleep_sessions
  weather TEXT, -- JSON
  location TEXT,
  is_private INTEGER DEFAULT 1,
  ai_summary TEXT, -- AI-generated summary of entry
  sentiment_score REAL, -- -1 to 1, AI-analyzed sentiment
  topics TEXT, -- JSON array of AI-extracted topics
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linked_activity_id) REFERENCES activities(id),
  FOREIGN KEY (linked_sleep_id) REFERENCES sleep_sessions(id)
);

CREATE TABLE reflections (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL DEFAULT 'default',
  reflection_date TEXT NOT NULL,
  reflection_type TEXT DEFAULT 'daily', -- daily, weekly, monthly, yearly
  prompt TEXT, -- The question or prompt used
  response TEXT NOT NULL,
  linked_entries TEXT, -- JSON array of journal_entry IDs
  insights TEXT, -- JSON array of AI-extracted insights
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL DEFAULT 'default',
  goal_type TEXT, -- fitness, wellness, personal, professional
  title TEXT NOT NULL,
  description TEXT,
  target_date TEXT,
  status TEXT DEFAULT 'active', -- active, completed, abandoned, on_hold
  progress_metric TEXT, -- What to measure
  target_value REAL,
  current_value REAL,
  unit TEXT,
  check_ins TEXT, -- JSON array of progress updates
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for wellness queries
CREATE INDEX idx_wellness_daily_user_date ON wellness_daily(user_id, date DESC);
CREATE INDEX idx_sleep_sessions_user_date ON sleep_sessions(user_id, date DESC);
CREATE INDEX idx_activities_user_date ON activities(user_id, started_at DESC);
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_reflections_user_date ON reflections(user_id, reflection_date DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);

PRAGMA foreign_keys = ON;
