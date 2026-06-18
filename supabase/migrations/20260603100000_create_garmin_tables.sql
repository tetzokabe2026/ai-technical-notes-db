CREATE TABLE garmin_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp_jst TIMESTAMPTZ NOT NULL UNIQUE,
  manufacturer TEXT,
  garmin_product INTEGER,
  serial_number BIGINT,
  type INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE garmin_wellness (
  id BIGSERIAL PRIMARY KEY,
  timestamp_jst TIMESTAMPTZ NOT NULL UNIQUE,
  stress_level INTEGER,
  hrv_rmssd INTEGER,
  hrv_sdrr INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE garmin_hrv_status (
  id BIGSERIAL PRIMARY KEY,
  timestamp_jst TIMESTAMPTZ NOT NULL UNIQUE,
  hrv_raw INTEGER,
  hrv_ms NUMERIC(10,1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE garmin_sleep_data (
  id BIGSERIAL PRIMARY KEY,
  timestamp_jst TIMESTAMPTZ NOT NULL,
  type TEXT,
  stage INTEGER,
  stage_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (timestamp_jst, type)
);

CREATE TABLE garmin_sleep_disruptions (
  id BIGSERIAL PRIMARY KEY,
  timestamp_jst TIMESTAMPTZ NOT NULL UNIQUE,
  index INTEGER,
  value INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- auto_expose_new_tables defaults to false after 2026-05-30, so explicit grants are required
GRANT ALL ON TABLE garmin_metrics TO service_role;
GRANT ALL ON TABLE garmin_wellness TO service_role;
GRANT ALL ON TABLE garmin_hrv_status TO service_role;
GRANT ALL ON TABLE garmin_sleep_data TO service_role;
GRANT ALL ON TABLE garmin_sleep_disruptions TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
