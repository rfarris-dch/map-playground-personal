from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import subprocess

from dagster import ConfigurableResource


@dataclass(frozen=True)
class CommandResult:
    command: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str


class TileCommandRunner(ConfigurableResource):
    project_root: str

    def run(
        self,
        command: tuple[str, ...],
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        merged_env = dict(os.environ)
        if env is not None:
            merged_env.update(env)

        completed = subprocess.run(
            command,
            cwd=Path(self.project_root),
            env=merged_env,
            capture_output=True,
            text=True,
            check=False,
        )
        return CommandResult(
            command=command,
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
