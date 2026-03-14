from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os


@dataclass(frozen=True)
class CommandConfig:
    command: tuple[str, ...]
    env: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class AssetStepConfig:
    asset_key: str
    commands: tuple[CommandConfig, ...]
    deps: tuple[str, ...] = ()


@dataclass(frozen=True)
class DatasetConfig:
    dataset: str
    display_name: str
    job_name: str
    steps: tuple[AssetStepConfig, ...]


def resolve_project_root() -> Path:
    configured = os.getenv("MAP_PROJECT_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()

    return Path(__file__).resolve().parents[4]


PROJECT_ROOT = resolve_project_root()
PARCELS_SNAPSHOT_ROOT = PROJECT_ROOT / "var" / "parcels-sync"
ENVIRONMENTAL_SNAPSHOT_ROOT = PROJECT_ROOT / "var" / "environmental-sync"
PUBLISH_ROOT = PROJECT_ROOT / "apps" / "web" / "public"
CACHE_ROOT = PROJECT_ROOT / ".cache"


def shell(*parts: str, env: dict[str, str] | None = None) -> CommandConfig:
    return CommandConfig(command=parts, env={} if env is None else env)


DATASETS: tuple[DatasetConfig, ...] = (
    DatasetConfig(
        dataset="parcels",
        display_name="Parcels",
        job_name="parcels_pipeline",
        steps=(
            AssetStepConfig(
                asset_key="raw_parcel_extract",
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-parcels.ts"),
                        f"--output-dir={PARCELS_SNAPSHOT_ROOT}",
                        "--run-id={run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="canonical_parcels",
                deps=("raw_parcel_extract",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/load-parcels-canonical.sh"),
                        str(PARCELS_SNAPSHOT_ROOT / "{run_id}"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="parcel_tilesource",
                deps=("canonical_parcels",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/refresh-parcel-tilesource.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="parcel_pmtiles",
                deps=("parcel_tilesource",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/build-parcels-draw-pmtiles.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="parcel_manifest_publish",
                deps=("parcel_pmtiles",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
                        "--dataset=parcels-draw-v1",
                        f"--output-root={PUBLISH_ROOT}",
                        "--ingestion-run-id={run_id}",
                        "--run-id={run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="validate",
                deps=("parcel_manifest_publish",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/validate-published-tiles.ts"),
                        "--dataset=parcels-draw-v1",
                        f"--output-root={PUBLISH_ROOT}",
                    ),
                ),
            ),
        ),
    ),
    DatasetConfig(
        dataset="flood",
        display_name="Flood",
        job_name="flood_pipeline",
        steps=(
            AssetStepConfig(
                asset_key="raw_fema_extract",
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-flood.ts"),
                        "--run-id={run_id}",
                        "--step=extract",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="canonical_flood_hazard",
                deps=("raw_fema_extract",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-flood.ts"),
                        "--run-id={run_id}",
                        "--step=normalize",
                    ),
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-flood.ts"),
                        "--run-id={run_id}",
                        "--step=load",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="flood100_tilesource",
                deps=("canonical_flood_hazard",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-flood-tilesources.sh"),
                        "{run_id}",
                        "100",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="flood500_tilesource",
                deps=("canonical_flood_hazard",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-flood-tilesources.sh"),
                        "{run_id}",
                        "500",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="flood_pmtiles",
                deps=("flood100_tilesource", "flood500_tilesource"),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/build-environmental-flood-pmtiles.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="flood_manifest_publish",
                deps=("flood_pmtiles",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
                        "--dataset=environmental-flood",
                        f"--output-root={PUBLISH_ROOT}",
                        f"--snapshot-root={ENVIRONMENTAL_SNAPSHOT_ROOT / 'environmental-flood'}",
                        f"--tiles-out-dir={CACHE_ROOT / 'tiles' / 'environmental-flood'}",
                        "--ingestion-run-id={run_id}",
                        "--run-id={run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="validate",
                deps=("flood_manifest_publish",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/validate-published-tiles.ts"),
                        "--dataset=environmental-flood",
                        f"--output-root={PUBLISH_ROOT}",
                    ),
                ),
            ),
        ),
    ),
    DatasetConfig(
        dataset="hydro-basins",
        display_name="Hydro Basins",
        job_name="hydro_basins_pipeline",
        steps=(
            AssetStepConfig(
                asset_key="raw_hydro_source",
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-hydro-basins.ts"),
                        "--run-id={run_id}",
                        "--step=extract",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="canonical_huc_polygons",
                deps=("raw_hydro_source",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-hydro-basins.ts"),
                        "--run-id={run_id}",
                        "--step=normalize",
                    ),
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/load-environmental-hydro-canonical.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="hydro_tilesource",
                deps=("canonical_huc_polygons",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/refresh-environmental-hydro-tilesource.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="hydro_pmtiles",
                deps=("hydro_tilesource",),
                commands=(
                    shell(
                        "bash",
                        str(PROJECT_ROOT / "scripts/build-environmental-hydro-basins-pmtiles.sh"),
                        "{run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="hydro_manifest_publish",
                deps=("hydro_pmtiles",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
                        "--dataset=environmental-hydro-basins",
                        f"--output-root={PUBLISH_ROOT}",
                        f"--snapshot-root={ENVIRONMENTAL_SNAPSHOT_ROOT / 'environmental-hydro-basins'}",
                        f"--tiles-out-dir={CACHE_ROOT / 'tiles' / 'environmental-hydro-basins'}",
                        "--ingestion-run-id={run_id}",
                        "--run-id={run_id}",
                    ),
                ),
            ),
            AssetStepConfig(
                asset_key="validate",
                deps=("hydro_manifest_publish",),
                commands=(
                    shell(
                        "bun",
                        "run",
                        str(PROJECT_ROOT / "scripts/validate-published-tiles.ts"),
                        "--dataset=environmental-hydro-basins",
                        f"--output-root={PUBLISH_ROOT}",
                    ),
                ),
            ),
        ),
    ),
)


_GAS_PIPELINES_DATASET = DatasetConfig(
    dataset="gas-pipelines",
    display_name="Gas Pipelines",
    job_name="gas_pipelines_pipeline",
    steps=(
        AssetStepConfig(
            asset_key="download_and_build",
            commands=(
                shell(
                    "bash",
                    str(PROJECT_ROOT / "scripts/refresh-gas-pipelines.sh"),
                    "{run_id}",
                ),
            ),
        ),
        AssetStepConfig(
            asset_key="gas_manifest_publish",
            deps=("download_and_build",),
            commands=(
                shell(
                    "bun",
                    "run",
                    str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
                    "--dataset=gas-pipelines-v1",
                    f"--output-root={PUBLISH_ROOT}",
                    f"--tiles-out-dir={CACHE_ROOT / 'tiles' / 'gas-pipelines-v1'}",
                    "--ingestion-run-id={run_id}",
                    "--run-id={run_id}",
                ),
            ),
        ),
        AssetStepConfig(
            asset_key="validate",
            deps=("gas_manifest_publish",),
            commands=(
                shell(
                    "bun",
                    "run",
                    str(PROJECT_ROOT / "scripts/validate-published-tiles.ts"),
                    "--dataset=gas-pipelines-v1",
                    f"--output-root={PUBLISH_ROOT}",
                ),
            ),
        ),
    ),
)

DATASETS = (*DATASETS, _GAS_PIPELINES_DATASET)


def get_dataset_config(dataset: str) -> DatasetConfig:
    for candidate in DATASETS:
        if candidate.dataset == dataset:
            return candidate

    raise KeyError(f"Unsupported dataset: {dataset}")
