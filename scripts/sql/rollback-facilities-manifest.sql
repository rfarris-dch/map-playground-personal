SELECT set_config(
  'map.rollback_facilities.target_version',
  COALESCE(NULLIF(BTRIM(:'target_version'), ''), ''),
  false
);

DO $body$
DECLARE
  target_version text :=
    NULLIF(current_setting('map.rollback_facilities.target_version', true), '');
  current_version text;
  previous_version text;
  rollback_target_version text;
  rollback_previous_version text;
BEGIN
  SELECT
    manifest.current_version,
    manifest.previous_version
  INTO current_version, previous_version
  FROM serve.facilities_dataset_manifest AS manifest
  WHERE manifest.dataset = 'facilities'
  FOR UPDATE;

  IF current_version IS NULL THEN
    RAISE EXCEPTION 'facilities dataset manifest is unavailable';
  END IF;

  rollback_target_version := COALESCE(target_version, previous_version);
  IF rollback_target_version IS NULL THEN
    RAISE EXCEPTION 'facilities dataset manifest has no rollback target';
  END IF;

  IF to_regclass(format('serve.%I', 'facility_site_fast__' || rollback_target_version)) IS NULL THEN
    RAISE EXCEPTION 'missing colocation facilities table for version %', rollback_target_version;
  END IF;

  IF to_regclass(format('serve.%I', 'hyperscale_site_fast__' || rollback_target_version)) IS NULL THEN
    RAISE EXCEPTION 'missing hyperscale facilities table for version %', rollback_target_version;
  END IF;

  IF rollback_target_version = current_version THEN
    RAISE NOTICE 'facilities manifest already points at version %', rollback_target_version;
    RETURN;
  END IF;

  rollback_previous_version :=
    CASE
      WHEN current_version = rollback_target_version THEN previous_version
      ELSE current_version
    END;

  UPDATE serve.facilities_dataset_manifest
  SET
    current_version = rollback_target_version,
    previous_version = rollback_previous_version,
    published_at = now(),
    warm_profile_version = NULL
  WHERE dataset = 'facilities';

  RAISE NOTICE
    'Rolled facilities manifest to version % (previous=%)',
    rollback_target_version,
    rollback_previous_version;
END
$body$;
