from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class DatasetConfig:
    dataset: str
    display_name: str
    sync_env: dict[str, str]
    sync_command: tuple[str, ...]
    build_env: dict[str, str]
    build_command: tuple[str, ...]
    publish_env: dict[str, str]
    publish_command: tuple[str, ...]
    asset_chain: tuple[str, ...]


def resolve_project_root() -> Path:
    configured = os.getenv("MAP_PROJECT_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()

    return Path(__file__).resolve().parents[4]


PROJECT_ROOT = resolve_project_root()

DATASETS: tuple[DatasetConfig, ...] = (
    DatasetConfig(
        dataset="parcels",
        display_name="Parcels",
        sync_env={},
        sync_command=("bash", str(PROJECT_ROOT / "scripts/refresh-parcels.sh")),
        build_env={},
        build_command=("bash", str(PROJECT_ROOT / "scripts/build-parcels-draw-pmtiles.sh")),
        publish_env={},
        publish_command=(
            "bun",
            "run",
            str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
            "--dataset=parcels-draw-v1",
        ),
        asset_chain=(
            "raw_parcel_extract",
            "canonical_parcels",
            "parcel_tilesource",
            "parcel_pmtiles",
            "published_manifest",
        ),
    ),
    DatasetConfig(
        dataset="flood",
        display_name="Flood",
        sync_env={"ENVIRONMENTAL_SYNC_DATASET": "environmental-flood"},
        sync_command=("bash", str(PROJECT_ROOT / "scripts/refresh-environmental-sync.sh")),
        build_env={},
        build_command=("bash", str(PROJECT_ROOT / "scripts/build-environmental-flood-pmtiles.sh")),
        publish_env={},
        publish_command=(
            "bun",
            "run",
            str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
            "--dataset=environmental-flood",
        ),
        asset_chain=(
            "raw_fema_extract",
            "canonical_flood_hazard",
            "flood_overlay_100_tilesource",
            "flood_overlay_500_tilesource",
            "flood_pmtiles",
            "published_manifest",
        ),
    ),
    DatasetConfig(
        dataset="hydro-basins",
        display_name="Hydro Basins",
        sync_env={"ENVIRONMENTAL_SYNC_DATASET": "environmental-hydro-basins"},
        sync_command=("bash", str(PROJECT_ROOT / "scripts/refresh-environmental-sync.sh")),
        build_env={},
        build_command=(
            "bash",
            str(PROJECT_ROOT / "scripts/build-environmental-hydro-basins-pmtiles.sh"),
        ),
        publish_env={},
        publish_command=(
            "bun",
            "run",
            str(PROJECT_ROOT / "scripts/publish-parcels-manifest.ts"),
            "--dataset=environmental-hydro-basins",
        ),
        asset_chain=(
            "raw_hydro_source",
            "canonical_hydro_tables",
            "hydro_tilesource",
            "hydro_pmtiles",
            "published_manifest",
        ),
    ),
)
