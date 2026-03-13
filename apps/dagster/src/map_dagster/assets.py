from __future__ import annotations

from dagster import AssetExecutionContext, AssetKey, AssetsDefinition, MaterializeResult, asset

from .config import CommandConfig, DATASETS, DatasetConfig
from .resources import TileCommandRunner


def _render_value(value: str, context: AssetExecutionContext) -> str:
    return value.format(
        run_id=context.run_id,
    )


def _render_command(
    context: AssetExecutionContext,
    command: CommandConfig,
) -> tuple[tuple[str, ...], dict[str, str]]:
    rendered_command = tuple(_render_value(part, context) for part in command.command)
    rendered_env = {
        key: _render_value(value, context)
        for key, value in {
            "RUN_ID": context.run_id,
            **command.env,
        }.items()
    }
    return rendered_command, rendered_env


def _run_command_asset(
    context: AssetExecutionContext,
    dataset: DatasetConfig,
    asset_key: str,
    commands: tuple[CommandConfig, ...],
) -> MaterializeResult:
    runner = context.resources.runner
    stdout_bytes = 0
    stderr_bytes = 0
    executed_commands: list[str] = []

    for command in commands:
        rendered_command, rendered_env = _render_command(context, command)
        result = runner.run(rendered_command, rendered_env)
        executed_commands.append(" ".join(result.command))
        stdout_bytes += len(result.stdout.encode("utf-8"))
        stderr_bytes += len(result.stderr.encode("utf-8"))
        if result.stdout:
            context.log.info(result.stdout.rstrip())
        if result.stderr:
            context.log.warning(result.stderr.rstrip())
        if result.returncode != 0:
            raise RuntimeError(
                f"{dataset.display_name} {asset_key} command failed with exit code {result.returncode}"
            )

    return MaterializeResult(
        metadata={
            "dataset": dataset.dataset,
            "asset": asset_key,
            "asset_chain": " -> ".join(step.asset_key for step in dataset.steps),
            "commands": "\n".join(executed_commands),
            "stdout_bytes": stdout_bytes,
            "stderr_bytes": stderr_bytes,
            "dagster_run_id": context.run_id,
        }
    )


def _dataset_assets(dataset: DatasetConfig) -> list[AssetsDefinition]:
    asset_key_map = {
        step.asset_key: AssetKey([dataset.dataset, step.asset_key]) for step in dataset.steps
    }
    assets: list[AssetsDefinition] = []

    def create_step_asset(step_name: str, commands: tuple[CommandConfig, ...], deps: list[AssetKey]):
        key_prefix = [dataset.dataset]

        @asset(
            name=step_name,
            key_prefix=key_prefix,
            group_name="tile_pipelines",
            compute_kind="shell",
            deps=deps,
            required_resource_keys={"runner"},
        )
        def step_asset(context) -> MaterializeResult:
            return _run_command_asset(context, dataset, step_name, commands)

        return step_asset

    for step in dataset.steps:
        dagster_deps = [asset_key_map[dep] for dep in step.deps]
        assets.append(create_step_asset(step.asset_key, step.commands, dagster_deps))

    return assets


def build_assets() -> list[AssetsDefinition]:
    assets: list[AssetsDefinition] = []
    for dataset in DATASETS:
        assets.extend(_dataset_assets(dataset))
    return assets
