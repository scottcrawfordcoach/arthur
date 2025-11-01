-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public._book_move_log (
  id bigint NOT NULL DEFAULT nextval('_book_move_log_id_seq'::regclass),
  old_path text,
  new_path text,
  moved_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  CONSTRAINT _book_move_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public._seed_activity_types (
  key text,
  display_name text,
  parent_key text
);
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type_id integer,
  source text NOT NULL DEFAULT 'import'::text,
  external_id text,
  dedupe_hash text NOT NULL,
  name text,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  is_outdoor boolean,
  user_comment text,
  rpe smallint,
  mood text,
  tags ARRAY,
  surface text,
  equipment jsonb,
  custom jsonb,
  elapsed_time_s integer,
  moving_time_s integer,
  distance_m integer,
  total_ascent_m integer,
  total_descent_m integer,
  avg_hr smallint,
  max_hr smallint,
  avg_power smallint,
  max_power smallint,
  avg_cadence smallint,
  max_cadence smallint,
  avg_speed_mps real,
  max_speed_mps real,
  calories_kcal integer,
  device_temp_avg_c real,
  device_temp_max_c real,
  device_temp_min_c real,
  weather_source text,
  weather_obs_time timestamp with time zone,
  weather_lat double precision,
  weather_lon double precision,
  weather_temp_c real,
  weather_feels_like_c real,
  weather_dewpoint_c real,
  weather_rh_pct real,
  weather_wind_speed_mps real,
  weather_wind_gust_mps real,
  weather_wind_dir_deg real,
  weather_pressure_hpa real,
  weather_precip_rate_mmph real,
  weather_condition_code text,
  weather_raw jsonb,
  device_id uuid,
  raw_fit jsonb,
  created_at timestamp with time zone DEFAULT now(),
  local_date date,
  week_start_local date,
  tz_used text,
  CONSTRAINT activities_pkey PRIMARY KEY (id),
  CONSTRAINT activities_activity_type_id_fkey FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id),
  CONSTRAINT activities_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.devices(id)
);
CREATE TABLE public.activity_laps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  seq integer NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone NOT NULL,
  distance_m integer,
  elapsed_time_s integer,
  avg_hr smallint,
  max_hr smallint,
  avg_power smallint,
  max_power smallint,
  avg_cadence smallint,
  max_cadence smallint,
  avg_speed_mps real,
  max_speed_mps real,
  calories_kcal integer,
  run_stride_len_m real,
  run_gct_ms real,
  run_gct_balance_pct real,
  run_vert_osc_mm real,
  run_vert_ratio_pct real,
  bike_lr_balance_pct real,
  bike_pedal_smooth_l_pct real,
  bike_pedal_smooth_r_pct real,
  bike_torque_eff_l_pct real,
  bike_torque_eff_r_pct real,
  bike_pco_l_mm real,
  bike_pco_r_mm real,
  bike_power_phase_l_start_deg real,
  bike_power_phase_l_end_deg real,
  bike_power_phase_r_start_deg real,
  bike_power_phase_r_end_deg real,
  bike_power_phase_l_arc_deg real,
  bike_power_phase_r_arc_deg real,
  comment text,
  custom jsonb,
  CONSTRAINT activity_laps_pkey PRIMARY KEY (id),
  CONSTRAINT activity_laps_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id)
);
CREATE TABLE public.activity_samples (
  activity_id uuid NOT NULL,
  ts timestamp with time zone NOT NULL,
  lat double precision,
  lon double precision,
  alt_m real,
  hr smallint,
  power smallint,
  cadence smallint,
  speed_mps real,
  temp_c real,
  run_stride_len_m real,
  run_gct_ms real,
  run_gct_balance_pct real,
  run_vert_osc_mm real,
  run_vert_ratio_pct real,
  bike_lr_balance_pct real,
  bike_pco_l_mm real,
  bike_pco_r_mm real,
  bike_power_phase_l_start_deg real,
  bike_power_phase_l_end_deg real,
  bike_power_phase_r_start_deg real,
  bike_power_phase_r_end_deg real,
  run_form_power_w real,
  run_air_power_w real,
  run_leg_spring_stiff_kn_m real,
  run_wind_speed_mps real,
  raw jsonb,
  CONSTRAINT activity_samples_pkey PRIMARY KEY (activity_id, ts),
  CONSTRAINT activity_samples_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id)
);
CREATE TABLE public.activity_types (
  id integer NOT NULL DEFAULT nextval('activity_types_id_seq'::regclass),
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  parent_key text,
  CONSTRAINT activity_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blood_pressure_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  systolic smallint NOT NULL,
  diastolic smallint NOT NULL,
  pulse smallint,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT blood_pressure_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blood_test_results (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  test_date date NOT NULL,
  test_type text,
  metrics jsonb,
  notes text,
  source text DEFAULT 'journal'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT blood_test_results_pkey PRIMARY KEY (id)
);
CREATE TABLE public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  waist_cm real,
  neck_cm real,
  bicep_cm real,
  thigh_cm real,
  hip_cm real,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT body_measurements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.body_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date_of_birth date,
  sex text,
  height_cm real,
  weight_kg real,
  date date NOT NULL,
  bmi real,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT body_stats_pkey PRIMARY KEY (id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  phone text,
  birthday date,
  company text,
  tags ARRAY,
  status text DEFAULT 'free'::text CHECK (status = ANY (ARRAY['free'::text, 'trial'::text, 'paid'::text])),
  created_at timestamp without time zone DEFAULT now(),
  address text,
  auth_id uuid,
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);
CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand text,
  model text,
  serial text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.endurance_score_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  device_garmin_id bigint,
  ts_gmt timestamp with time zone,
  overall_score integer,
  classification smallint,
  feedback_phrase smallint,
  primary_training_device boolean,
  contributors jsonb,
  source text DEFAULT 'import'::text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT endurance_score_daily_pkey PRIMARY KEY (id)
);
CREATE TABLE public.file_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL,
  version integer NOT NULL,
  content_text text NOT NULL,
  sha256 text NOT NULL,
  changelog jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT file_versions_pkey PRIMARY KEY (id),
  CONSTRAINT file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.project_files(id),
  CONSTRAINT file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.goal_habits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  name text NOT NULL,
  cadence text NOT NULL CHECK (cadence = ANY (ARRAY['daily'::text, 'weekly'::text])),
  target_freq integer NOT NULL,
  min_viable text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  rule_log_type text,
  rule_phrases ARRAY,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT goal_habits_pkey PRIMARY KEY (id),
  CONSTRAINT goal_habits_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.user_goals(id)
);
CREATE TABLE public.goal_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  target_freq_sum integer NOT NULL,
  actual_freq_sum integer NOT NULL DEFAULT 0,
  adherence_pct numeric DEFAULT 
CASE
    WHEN (target_freq_sum > 0) THEN round(((100.0 * (actual_freq_sum)::numeric) / (target_freq_sum)::numeric), 1)
    ELSE (0)::numeric
END,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'green'::text, 'amber'::text, 'red'::text])),
  blockers text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT goal_periods_pkey PRIMARY KEY (id),
  CONSTRAINT goal_periods_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.user_goals(id)
);
CREATE TABLE public.goal_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goal_id uuid,
  progress_text text,
  created_at timestamp with time zone DEFAULT now(),
  detected_from_message_id uuid,
  CONSTRAINT goal_progress_pkey PRIMARY KEY (id),
  CONSTRAINT goal_progress_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.user_goals(id),
  CONSTRAINT goal_progress_detected_from_message_id_fkey FOREIGN KEY (detected_from_message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.health_calculations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  calculation_type text NOT NULL,
  value numeric,
  units text,
  source_data jsonb,
  calculated_at timestamp with time zone DEFAULT now(),
  notes text,
  CONSTRAINT health_calculations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hr_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sport text NOT NULL,
  training_method text,
  resting_hr_used smallint,
  lthr_used smallint,
  max_hr_used smallint,
  zone1_floor smallint,
  zone2_floor smallint,
  zone3_floor smallint,
  zone4_floor smallint,
  zone5_floor smallint,
  change_state text,
  effective_from timestamp with time zone DEFAULT now(),
  source text DEFAULT 'import'::text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT hr_zones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hrv_status_daily (
  user_id uuid NOT NULL,
  date date NOT NULL,
  rmssd_ms real,
  ln_rmssd real,
  night_hr_avg_bpm real,
  status_label text,
  avg_7d_ms real,
  avg_30d_ms real,
  baseline_low_ms real,
  baseline_high_ms real,
  source text DEFAULT 'import'::text,
  raw jsonb,
  CONSTRAINT hrv_status_daily_pkey PRIMARY KEY (user_id, date)
);
CREATE TABLE public.hydration_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_date date NOT NULL,
  ts_local timestamp with time zone NOT NULL,
  ts_gmt timestamp with time zone,
  hydration_source text,
  value_ml real NOT NULL DEFAULT 0,
  estimated_sweat_loss_ml real,
  duration_s real,
  capped boolean,
  activity_external_id text,
  activity_id uuid,
  source text DEFAULT 'import'::text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT hydration_events_pkey PRIMARY KEY (id),
  CONSTRAINT hydration_events_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id)
);
CREATE TABLE public.log_annotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = 'emotion'::text),
  data jsonb NOT NULL,
  source text DEFAULT 'prompt'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT log_annotations_pkey PRIMARY KEY (id),
  CONSTRAINT log_annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT log_annotations_log_id_fkey FOREIGN KEY (log_id) REFERENCES public.messages(id)
);
CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL,
  content text NOT NULL,
  parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_version text NOT NULL DEFAULT 'v1'::text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb,
  CONSTRAINT logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  mode text NOT NULL DEFAULT 'journal'::text,
  type USER-DEFINED NOT NULL DEFAULT 'other'::entry_type,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.misc_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  entry_text text NOT NULL,
  context jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT misc_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nutrition_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source = ANY (ARRAY['photo'::text, 'text'::text, 'barcode'::text])),
  description text,
  photo_ref text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals jsonb,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'rejected'::text])),
  CONSTRAINT nutrition_logs_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.platform_prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'ScottBot Platform'::text,
  summary text,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_prefs_pkey PRIMARY KEY (id),
  CONSTRAINT platform_prefs_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.power_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sport text NOT NULL,
  functional_threshold_power real,
  zone1_floor real,
  zone2_floor real,
  zone3_floor real,
  zone4_floor real,
  zone5_floor real,
  zone6_floor real,
  zone7_floor real,
  effective_from timestamp with time zone DEFAULT now(),
  source text DEFAULT 'import'::text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT power_zones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  key text NOT NULL,
  value_numeric double precision,
  value_json jsonb,
  source text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prefs_pkey PRIMARY KEY (id),
  CONSTRAINT prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  tz text NOT NULL DEFAULT 'UTC'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.project_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text,
  latest_version integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT project_files_pkey PRIMARY KEY (id),
  CONSTRAINT project_files_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.reference_library_chunks (
  id text NOT NULL,
  document_id uuid,
  chunk_index integer NOT NULL,
  total_chunks integer NOT NULL,
  content text NOT NULL,
  token_count integer,
  section_title text,
  prev_chunk_id text,
  next_chunk_id text,
  category text,
  writing_type text,
  voice_sample boolean DEFAULT false,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  restricted boolean DEFAULT true,
  redistribution_policy text DEFAULT 'inspiration_only'::text,
  privacy_level text DEFAULT 'restricted'::text,
  allow_verbatim_export boolean DEFAULT false,
  CONSTRAINT reference_library_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT reference_library_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.reference_library_documents(id)
);
CREATE TABLE public.reference_library_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  category text,
  tags ARRAY,
  keywords ARRAY,
  writing_type text,
  voice_sample boolean DEFAULT false,
  original_filename text,
  file_type text,
  source_url text,
  storage_path text,
  date_added timestamp with time zone DEFAULT now(),
  date_modified timestamp with time zone DEFAULT now(),
  chunk_count integer DEFAULT 0,
  license_type text DEFAULT 'All Rights Reserved'::text,
  restricted boolean DEFAULT true,
  redistribution_policy text DEFAULT 'inspiration_only'::text,
  citation_required boolean DEFAULT true,
  privacy_level text DEFAULT 'restricted'::text,
  use_in_generation boolean DEFAULT true,
  allow_verbatim_export boolean DEFAULT false,
  embedding_status text DEFAULT 'summary_only'::text,
  ingested_at timestamp with time zone DEFAULT now(),
  source_quality text DEFAULT 'verified'::text,
  CONSTRAINT reference_library_documents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_deltas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  file_id uuid,
  delta jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT session_deltas_pkey PRIMARY KEY (id),
  CONSTRAINT session_deltas_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.project_files(id),
  CONSTRAINT session_deltas_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.sleep_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  duration_min integer,
  efficiency smallint,
  score smallint,
  latency_min integer,
  awakenings integer,
  light_min integer,
  deep_min integer,
  rem_min integer,
  awake_min integer,
  respiration_rate_avg real,
  spo2_avg real,
  hr_min_bpm smallint,
  hr_avg_bpm smallint,
  quality_label text,
  factors jsonb,
  source text DEFAULT 'import'::text,
  raw jsonb,
  is_nap boolean DEFAULT false,
  sleep_window_confirmation_type text,
  restless_moment_count integer,
  avg_sleep_stress real,
  CONSTRAINT sleep_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.telegram_users (
  telegram_id bigint NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT telegram_users_pkey PRIMARY KEY (telegram_id),
  CONSTRAINT telegram_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id text NOT NULL,
  version smallint NOT NULL,
  raw_answers jsonb NOT NULL,
  computed jsonb NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT user_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_coach_support (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  last_offered timestamp with time zone DEFAULT now(),
  reason text,
  CONSTRAINT user_coach_support_pkey PRIMARY KEY (id),
  CONSTRAINT user_coach_support_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_deletion_requests (
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'processing'::text, 'done'::text, 'canceled'::text])),
  execute_after timestamp with time zone NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_deletion_requests_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.user_domain_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  note text NOT NULL,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  source text NOT NULL DEFAULT 'nlp'::text,
  inferred boolean NOT NULL DEFAULT false,
  context jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_domain_notes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  goal_text text NOT NULL,
  goal_type text CHECK (goal_type = ANY (ARRAY['finite'::text, 'infinite'::text])),
  category text CHECK (category = ANY (ARRAY['wellness'::text, 'performance'::text])),
  parent_goal_id uuid,
  chunked_goal boolean DEFAULT false,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])),
  due_date date,
  detected_from_message_id uuid,
  title text,
  why text,
  domain text CHECK (domain = ANY (ARRAY['fitness'::text, 'nutrition'::text, 'mood'::text, 'productivity'::text])),
  metric_name text,
  baseline numeric,
  target numeric,
  units text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_goals_pkey PRIMARY KEY (id),
  CONSTRAINT user_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_goals_parent_goal_id_fkey FOREIGN KEY (parent_goal_id) REFERENCES public.user_goals(id),
  CONSTRAINT user_goals_detected_from_message_id_fkey FOREIGN KEY (detected_from_message_id) REFERENCES public.messages(id)
);
CREATE TABLE public.user_identities (
  provider text NOT NULL CHECK (provider = ANY (ARRAY['telegram'::text, 'supabase'::text, 'google'::text, 'github'::text])),
  external_id text NOT NULL,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_identities_pkey PRIMARY KEY (provider, external_id)
);
CREATE TABLE public.user_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'journal'::text,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['fact'::text, 'preference'::text, 'history'::text, 'project'::text, 'writing'::text])),
  content text NOT NULL,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen timestamp with time zone,
  CONSTRAINT user_memory_pkey PRIMARY KEY (id),
  CONSTRAINT user_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_prefs (
  user_id uuid NOT NULL,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_prefs_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.user_profile_mode (
  user_id uuid NOT NULL,
  mode text NOT NULL,
  system_prompt text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_mode_pkey PRIMARY KEY (user_id, mode),
  CONSTRAINT user_profile_mode_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vo2_max_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calendar_date date NOT NULL,
  ts_gmt timestamp with time zone NOT NULL,
  sport text,
  sub_sport text,
  vo2_max_value real NOT NULL,
  activity_external_id text,
  activity_id uuid,
  source text DEFAULT 'import'::text,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vo2_max_events_pkey PRIMARY KEY (id),
  CONSTRAINT vo2_max_events_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id)
);
CREATE TABLE public.voice_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['scott_material'::text, 'external_reference'::text, 'system'::text])),
  title text NOT NULL,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  content text NOT NULL,
  weight integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT voice_resources_pkey PRIMARY KEY (id)
);
CREATE TABLE public.wellness_daily (
  user_id uuid NOT NULL,
  date date NOT NULL,
  steps integer,
  floors integer,
  resting_hr smallint,
  avg_hr smallint,
  max_hr smallint,
  calories_total_kcal integer,
  calories_active_kcal integer,
  calories_resting_kcal integer,
  stress_avg smallint,
  stress_max smallint,
  body_battery_min smallint,
  body_battery_max smallint,
  body_battery_change smallint,
  intensity_min_mod integer,
  intensity_min_vig integer,
  respiration_rate_avg real,
  spo2_avg real,
  spo2_min real,
  spo2_time_below90_min integer,
  vo2max_running real,
  vo2max_cycling real,
  weight_kg real,
  bmi real,
  temp_mean_c real,
  temp_min_c real,
  temp_max_c real,
  source text DEFAULT 'import'::text,
  raw jsonb,
  protein_total_g integer,
  carbs_total_g integer,
  fat_total_g integer,
  hydration_ml integer,
  CONSTRAINT wellness_daily_pkey PRIMARY KEY (user_id, date)
);
CREATE TABLE public.wellness_metrics (
  key text NOT NULL,
  display_name text NOT NULL,
  unit text,
  data_type text,
  category text,
  vendors_supported text,
  CONSTRAINT wellness_metrics_pkey PRIMARY KEY (key)
);