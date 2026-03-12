CREATE SCHEMA IF NOT EXISTS facility_current;

CREATE TABLE IF NOT EXISTS facility_current.providers (
  provider_id text PRIMARY KEY,
  provider_name text NOT NULL,
  category text,
  country text,
  state text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS providers_name_idx
  ON facility_current.providers (provider_name);

CREATE INDEX IF NOT EXISTS providers_updated_at_idx
  ON facility_current.providers (updated_at DESC);
