CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS market_current;

CREATE TABLE IF NOT EXISTS market_current.market_boundaries (
  market_id text PRIMARY KEY,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  center geometry(Point, 4326),
  source_version text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_boundaries_geom_idx
  ON market_current.market_boundaries
  USING gist (geom);
