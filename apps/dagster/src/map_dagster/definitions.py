from __future__ import annotations

from dagster import AssetKey, AssetSelection, Definitions, define_asset_job

from .assets import build_assets
from .config import DATASETS, PROJECT_ROOT
from .resources import TileCommandRunner


jobs = [
    define_asset_job(
        name=dataset.job_name,
        selection=AssetSelection.assets(
            *[AssetKey([dataset.dataset, step.asset_key]) for step in dataset.steps]
        ),
        tags={
            "dataset": dataset.dataset,
        },
    )
    for dataset in DATASETS
]


defs = Definitions(
    assets=build_assets(),
    jobs=jobs,
    resources={
        "runner": TileCommandRunner(project_root=str(PROJECT_ROOT)),
    },
)
