from __future__ import annotations

from dagster import Definitions

from .assets import build_assets
from .config import PROJECT_ROOT
from .resources import TileCommandRunner


defs = Definitions(
    assets=build_assets(),
    resources={
        "runner": TileCommandRunner(project_root=str(PROJECT_ROOT)),
    },
)
