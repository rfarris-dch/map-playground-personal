from __future__ import annotations

from dagster import AssetExecutionContext, AssetKey, AssetsDefinition, MaterializeResult, asset

from .config import DATASETS, DatasetConfig
from .resources import TileCommandRunner


def _run_command_asset(
    context: AssetExecutionContext,
    runner: TileCommandRunner,
    dataset: DatasetConfig,
    command: tuple[str, ...],
    env: dict[str, str],
    step_name: str,
) -> MaterializeResult:
    result = runner.run(command, env)
    if result.stdout:
        context.log.info(result.stdout.rstrip())
    if result.stderr:
        context.log.warning(result.stderr.rstrip())
    if result.returncode != 0:
        raise RuntimeError(
            f"{dataset.display_name} {step_name} command failed with exit code {result.returncode}"
        )

    return MaterializeResult(
        metadata={
            "dataset": dataset.dataset,
            "step": step_name,
            "command": " ".join(result.command),
            "asset_chain": " -> ".join(dataset.asset_chain),
            "stdout_bytes": len(result.stdout.encode("utf-8")),
            "stderr_bytes": len(result.stderr.encode("utf-8")),
        }
    )


def _dataset_assets(dataset: DatasetConfig) -> list[AssetsDefinition]:
    sync_key = AssetKey([dataset.dataset, "sync"])
    build_key = AssetKey([dataset.dataset, "pmtiles"])
    publish_key = AssetKey([dataset.dataset, "published_manifest"])

    @asset(
        name=f"{dataset.dataset.replace('-', '_')}_sync",
        key=sync_key,
        group_name="tile_pipelines",
        compute_kind="shell",
    )
    def sync_asset(context: AssetExecutionContext, runner: TileCommandRunner) -> MaterializeResult:
        return _run_command_asset(
            context,
            runner,
            dataset,
            dataset.sync_command,
            dataset.sync_env,
            "sync",
        )

    @asset(
        name=f"{dataset.dataset.replace('-', '_')}_pmtiles",
        key=build_key,
        group_name="tile_pipelines",
        compute_kind="shell",
        deps=[sync_key],
    )
    def build_asset(context: AssetExecutionContext, runner: TileCommandRunner) -> MaterializeResult:
        return _run_command_asset(
            context,
            runner,
            dataset,
            dataset.build_command,
            dataset.build_env,
            "build",
        )

    @asset(
        name=f"{dataset.dataset.replace('-', '_')}_published_manifest",
        key=publish_key,
        group_name="tile_pipelines",
        compute_kind="shell",
        deps=[build_key],
    )
    def publish_asset(
        context: AssetExecutionContext, runner: TileCommandRunner
    ) -> MaterializeResult:
        return _run_command_asset(
            context,
            runner,
            dataset,
            dataset.publish_command,
            dataset.publish_env,
            "publish",
        )

    return [sync_asset, build_asset, publish_asset]


def build_assets() -> list[AssetsDefinition]:
    assets: list[AssetsDefinition] = []
    for dataset in DATASETS:
        assets.extend(_dataset_assets(dataset))
    return assets
