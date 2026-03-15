-- Phase 0: Market & Submarket Boundary Map Layers
-- PostGIS schema for submarket center points and Voronoi-generated boundaries

-- 0A. Submarket center points (synced from HawkSuite MySQL)
CREATE TABLE IF NOT EXISTS market_current.submarket_points (
  submarket_id text PRIMARY KEY,
  name         text NOT NULL,
  market_id    text NOT NULL REFERENCES market_current.markets(market_id),
  center       geometry(Point, 4326) NOT NULL,
  external_id  text,
  imported_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submarket_points_center_idx ON market_current.submarket_points USING gist (center);
CREATE INDEX IF NOT EXISTS submarket_points_market_id_idx ON market_current.submarket_points (market_id);

-- 0C. Materialized view: Voronoi tessellation clipped to parent market boundaries
CREATE MATERIALIZED VIEW IF NOT EXISTS market_current.submarket_boundaries AS
WITH submarket_with_market AS (
  SELECT sp.submarket_id, sp.name AS submarket_name,
         sp.market_id, m.name AS market_name, sp.center, mb.geom AS market_geom
  FROM market_current.submarket_points sp
  JOIN market_current.markets m ON m.market_id = sp.market_id
  JOIN market_current.market_boundaries mb ON mb.market_id = sp.market_id
),
market_voronoi AS (
  SELECT market_id, market_geom,
         ST_VoronoiPolygons(ST_Collect(center), 0.0, ST_Envelope(market_geom)) AS voronoi_collection
  FROM submarket_with_market
  GROUP BY market_id, market_geom
),
voronoi_cells AS (
  SELECT market_id, market_geom, (ST_Dump(voronoi_collection)).geom AS cell_geom
  FROM market_voronoi
),
matched_cells AS (
  SELECT DISTINCT ON (swm.submarket_id)
    swm.submarket_id, swm.submarket_name, swm.market_id, swm.market_name,
    ST_Intersection(vc.cell_geom, vc.market_geom) AS geom
  FROM voronoi_cells vc
  JOIN submarket_with_market swm ON swm.market_id = vc.market_id AND ST_Contains(vc.cell_geom, swm.center)
)
SELECT submarket_id, submarket_name, market_id, market_name, geom
FROM matched_cells WHERE NOT ST_IsEmpty(geom);

CREATE UNIQUE INDEX IF NOT EXISTS submarket_boundaries_submarket_id_idx ON market_current.submarket_boundaries (submarket_id);
CREATE INDEX IF NOT EXISTS submarket_boundaries_geom_idx ON market_current.submarket_boundaries USING gist (geom);
CREATE INDEX IF NOT EXISTS submarket_boundaries_market_id_idx ON market_current.submarket_boundaries (market_id);

-- To refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY market_current.submarket_boundaries;
