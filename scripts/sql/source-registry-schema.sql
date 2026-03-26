CREATE SCHEMA IF NOT EXISTS registry;

CREATE TABLE IF NOT EXISTS registry.source_definition (
  source_id text NOT NULL,
  registry_version text NOT NULL,
  source_name text NOT NULL,
  provider_name text NOT NULL,
  source_family text NOT NULL,
  source_type text NOT NULL,
  integration_state text NOT NULL,
  owner_team text NOT NULL,
  status text NOT NULL,
  surface_scopes text[] NOT NULL,
  default_role text NOT NULL,
  precision_tier text NOT NULL,
  launch_criticality text NOT NULL,
  coverage_geography text NOT NULL,
  coverage_grain text NOT NULL,
  geometry_type text NOT NULL,
  provider_update_cadence text NOT NULL,
  production_method text NOT NULL,
  evidence_type text NOT NULL,
  description text NOT NULL,
  known_gaps text NOT NULL,
  code_entrypoint text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, registry_version),
  CHECK (source_family IN (
    'government_primary',
    'government_distributed',
    'operator_public',
    'commercial_licensed',
    'consultant_curated',
    'internal_curated',
    'nonprofit_research'
  )),
  CHECK (status IN ('active', 'planned', 'deprecated', 'blocked')),
  CHECK (cardinality(surface_scopes) >= 1),
  CHECK (surface_scopes <@ ARRAY['county', 'corridor', 'parcel']::text[]),
  CHECK (default_role IN ('primary', 'contextual', 'validation', 'fallback')),
  CHECK (precision_tier IN ('A', 'B', 'C')),
  CHECK (launch_criticality IN ('blocking', 'gated', 'supporting', 'deferred')),
  CHECK (coverage_geography IN ('national_us', 'regional', 'state', 'market', 'county', 'parcel')),
  CHECK (geometry_type IN ('tabular', 'point', 'line', 'polygon', 'edge')),
  CHECK (production_method IN ('surveyed', 'digitized', 'reported', 'curated', 'modeled')),
  CHECK (evidence_type IN ('observed', 'reported', 'curated', 'modeled', 'inferred')),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS source_definition_registry_version_idx
  ON registry.source_definition (registry_version, status);

CREATE TABLE IF NOT EXISTS registry.source_version (
  source_version_id text NOT NULL,
  registry_version text NOT NULL,
  source_id text NOT NULL,
  provider_version_label text NOT NULL,
  source_as_of_date date,
  source_release_date date,
  schema_version text NOT NULL,
  geographic_extent_version text NOT NULL,
  change_type text NOT NULL,
  approval_status text NOT NULL,
  change_notes text NOT NULL,
  checksum_or_fingerprint text,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_version_id, registry_version),
  FOREIGN KEY (source_id, registry_version)
    REFERENCES registry.source_definition (source_id, registry_version)
    ON DELETE CASCADE,
  CHECK (change_type IN (
    'initial_seed',
    'refresh',
    'schema_drift',
    'methodology_change',
    'coverage_change',
    'carry_forward'
  )),
  CHECK (approval_status IN ('approved', 'planned', 'deprecated', 'blocked')),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS source_version_source_idx
  ON registry.source_version (source_id, registry_version, approval_status);

CREATE TABLE IF NOT EXISTS registry.source_runtime_status (
  source_id text PRIMARY KEY,
  current_registry_version text NOT NULL,
  current_source_version_id text NOT NULL,
  last_successful_ingest_at timestamptz,
  last_attempted_ingest_at timestamptz,
  latest_provider_update_seen_at timestamptz,
  freshness_as_of timestamptz,
  staleness_state text NOT NULL,
  ingestion_health text NOT NULL,
  access_status text NOT NULL,
  runtime_alert_state text NOT NULL,
  record_count bigint,
  completeness_observed numeric(5, 4),
  geographic_coverage_observed text,
  license_expiration_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_id, current_registry_version)
    REFERENCES registry.source_definition (source_id, registry_version),
  FOREIGN KEY (current_source_version_id, current_registry_version)
    REFERENCES registry.source_version (source_version_id, registry_version),
  CHECK (staleness_state IN ('fresh', 'aging', 'stale', 'critical', 'unknown')),
  CHECK (ingestion_health IN ('healthy', 'degraded', 'failed', 'not_run')),
  CHECK (access_status IN ('accessible', 'cached_only', 'lost_access', 'pending_renewal', 'planned')),
  CHECK (runtime_alert_state IN ('none', 'warning', 'blocking', 'investigating')),
  CHECK (record_count IS NULL OR record_count >= 0),
  CHECK (
    completeness_observed IS NULL
    OR (completeness_observed >= 0 AND completeness_observed <= 1)
  )
);

CREATE INDEX IF NOT EXISTS source_runtime_status_registry_idx
  ON registry.source_runtime_status (current_registry_version, staleness_state, ingestion_health);

CREATE TABLE IF NOT EXISTS registry.source_dependency_rule (
  dependency_rule_id text NOT NULL,
  registry_version text NOT NULL,
  source_id text NOT NULL,
  downstream_object_type text NOT NULL,
  downstream_object_id text NOT NULL,
  role_in_downstream text NOT NULL,
  requiredness text NOT NULL,
  warn_if_days_stale integer,
  degrade_if_days_stale integer,
  suppress_if_days_stale integer,
  suppress_if_missing boolean NOT NULL DEFAULT false,
  precision_tier_c_allowed_for_primary boolean NOT NULL DEFAULT false,
  allowed_roles text[] NOT NULL,
  truth_mode_cap text NOT NULL,
  confidence_cap text,
  surface_scopes text[] NOT NULL,
  geography_scope text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dependency_rule_id, registry_version),
  FOREIGN KEY (source_id, registry_version)
    REFERENCES registry.source_definition (source_id, registry_version)
    ON DELETE CASCADE,
  CHECK (downstream_object_type IN ('metric', 'feature', 'score', 'surface', 'packet_section', 'model_input')),
  CHECK (role_in_downstream IN ('primary', 'contextual', 'validation', 'fallback')),
  CHECK (requiredness IN ('required', 'optional', 'enhancing')),
  CHECK (warn_if_days_stale IS NULL OR warn_if_days_stale > 0),
  CHECK (degrade_if_days_stale IS NULL OR degrade_if_days_stale > 0),
  CHECK (suppress_if_days_stale IS NULL OR suppress_if_days_stale > 0),
  CHECK (
    warn_if_days_stale IS NULL
    OR degrade_if_days_stale IS NULL
    OR warn_if_days_stale <= degrade_if_days_stale
  ),
  CHECK (
    degrade_if_days_stale IS NULL
    OR suppress_if_days_stale IS NULL
    OR degrade_if_days_stale <= suppress_if_days_stale
  ),
  CHECK (cardinality(allowed_roles) >= 1),
  CHECK (allowed_roles <@ ARRAY['primary', 'contextual', 'validation', 'fallback']::text[]),
  CHECK (
    truth_mode_cap IN ('full', 'validated_screening', 'derived_screening', 'context_only', 'internal_only')
  ),
  CHECK (confidence_cap IS NULL OR confidence_cap IN ('high', 'medium', 'low')),
  CHECK (cardinality(surface_scopes) >= 1),
  CHECK (surface_scopes <@ ARRAY['county', 'corridor', 'parcel']::text[]),
  CHECK (geography_scope IN ('national', 'market', 'state', 'utility', 'county', 'corridor', 'parcel')),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS source_dependency_rule_registry_idx
  ON registry.source_dependency_rule (registry_version, downstream_object_type, downstream_object_id);

CREATE OR REPLACE VIEW registry.active_sources AS
WITH latest_registry_version AS (
  SELECT source_definition.registry_version
  FROM registry.source_definition AS source_definition
  WHERE source_definition.effective_to IS NULL
  GROUP BY source_definition.registry_version
  ORDER BY MAX(source_definition.effective_from) DESC, source_definition.registry_version DESC
  LIMIT 1
)
SELECT
  source_definition.source_id,
  source_definition.registry_version,
  source_definition.source_name,
  source_definition.provider_name,
  source_definition.source_family,
  source_definition.source_type,
  source_definition.integration_state,
  source_definition.owner_team,
  source_definition.status,
  source_definition.surface_scopes,
  source_definition.default_role,
  source_definition.precision_tier,
  source_definition.launch_criticality,
  source_definition.coverage_geography,
  source_definition.coverage_grain,
  source_definition.geometry_type,
  source_definition.provider_update_cadence,
  source_definition.production_method,
  source_definition.evidence_type,
  source_definition.description,
  source_definition.known_gaps,
  source_definition.code_entrypoint,
  source_runtime_status.current_source_version_id,
  source_version.provider_version_label,
  source_version.source_as_of_date,
  source_version.source_release_date,
  source_version.schema_version,
  source_version.geographic_extent_version,
  source_runtime_status.staleness_state,
  source_runtime_status.ingestion_health,
  source_runtime_status.access_status,
  source_runtime_status.runtime_alert_state,
  source_runtime_status.last_successful_ingest_at,
  source_runtime_status.latest_provider_update_seen_at,
  source_runtime_status.record_count,
  source_runtime_status.completeness_observed,
  source_runtime_status.updated_at
FROM registry.source_definition AS source_definition
JOIN latest_registry_version
  ON latest_registry_version.registry_version = source_definition.registry_version
LEFT JOIN registry.source_runtime_status AS source_runtime_status
  ON source_runtime_status.source_id = source_definition.source_id
  AND source_runtime_status.current_registry_version = source_definition.registry_version
LEFT JOIN registry.source_version AS source_version
  ON source_version.source_version_id = source_runtime_status.current_source_version_id
  AND source_version.registry_version = source_runtime_status.current_registry_version
WHERE source_definition.effective_to IS NULL;

CREATE OR REPLACE VIEW registry.current_source_status AS
WITH latest_registry_version AS (
  SELECT source_definition.registry_version
  FROM registry.source_definition AS source_definition
  WHERE source_definition.effective_to IS NULL
  GROUP BY source_definition.registry_version
  ORDER BY MAX(source_definition.effective_from) DESC, source_definition.registry_version DESC
  LIMIT 1
)
SELECT
  source_runtime_status.source_id,
  source_runtime_status.current_registry_version AS registry_version,
  source_runtime_status.current_source_version_id AS source_version_id,
  source_definition.source_name,
  source_definition.launch_criticality,
  source_runtime_status.last_successful_ingest_at,
  source_runtime_status.last_attempted_ingest_at,
  source_runtime_status.latest_provider_update_seen_at,
  source_runtime_status.freshness_as_of,
  source_runtime_status.staleness_state,
  source_runtime_status.ingestion_health,
  source_runtime_status.access_status,
  source_runtime_status.runtime_alert_state,
  source_runtime_status.record_count,
  source_runtime_status.completeness_observed,
  source_runtime_status.geographic_coverage_observed,
  source_runtime_status.license_expiration_date,
  source_runtime_status.updated_at
FROM registry.source_runtime_status AS source_runtime_status
JOIN latest_registry_version
  ON latest_registry_version.registry_version = source_runtime_status.current_registry_version
JOIN registry.source_definition AS source_definition
  ON source_definition.source_id = source_runtime_status.source_id
  AND source_definition.registry_version = source_runtime_status.current_registry_version
WHERE source_definition.effective_to IS NULL;

CREATE OR REPLACE VIEW registry.downstream_rules AS
WITH latest_registry_version AS (
  SELECT source_definition.registry_version
  FROM registry.source_definition AS source_definition
  WHERE source_definition.effective_to IS NULL
  GROUP BY source_definition.registry_version
  ORDER BY MAX(source_definition.effective_from) DESC, source_definition.registry_version DESC
  LIMIT 1
)
SELECT
  source_dependency_rule.dependency_rule_id,
  source_dependency_rule.registry_version,
  source_dependency_rule.source_id,
  source_definition.source_name,
  source_dependency_rule.downstream_object_type,
  source_dependency_rule.downstream_object_id,
  source_dependency_rule.role_in_downstream,
  source_dependency_rule.requiredness,
  source_dependency_rule.warn_if_days_stale,
  source_dependency_rule.degrade_if_days_stale,
  source_dependency_rule.suppress_if_days_stale,
  source_dependency_rule.suppress_if_missing,
  source_dependency_rule.precision_tier_c_allowed_for_primary,
  source_dependency_rule.allowed_roles,
  source_dependency_rule.truth_mode_cap,
  source_dependency_rule.confidence_cap,
  source_dependency_rule.surface_scopes,
  source_dependency_rule.geography_scope
FROM registry.source_dependency_rule AS source_dependency_rule
JOIN latest_registry_version
  ON latest_registry_version.registry_version = source_dependency_rule.registry_version
JOIN registry.source_definition AS source_definition
  ON source_definition.source_id = source_dependency_rule.source_id
  AND source_definition.registry_version = source_dependency_rule.registry_version
WHERE source_dependency_rule.effective_to IS NULL
  AND source_definition.effective_to IS NULL;
