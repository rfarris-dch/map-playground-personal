from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from typing import Any

from dagster import DagsterInstance
from dagster._core.storage.dagster_run import DagsterRunStatus, RunRecord, RunsFilter

from .config import DATASETS, PROJECT_ROOT, DatasetConfig, get_dataset_config

RUNNING_STATUSES = {
    DagsterRunStatus.QUEUED,
    DagsterRunStatus.NOT_STARTED,
    DagsterRunStatus.MANAGED,
    DagsterRunStatus.STARTING,
    DagsterRunStatus.STARTED,
}
LOG_TAIL_LIMIT = 20
POLL_INTERVAL_MS = 3_000


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _to_iso(value: object) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")

    return None


def _duration_ms(started_at: str | None, ended_at: str | None) -> int | None:
    if started_at is None or ended_at is None:
        return None

    started_at_ms = datetime.fromisoformat(started_at.replace("Z", "+00:00")).timestamp() * 1000
    ended_at_ms = datetime.fromisoformat(ended_at.replace("Z", "+00:00")).timestamp() * 1000
    if ended_at_ms < started_at_ms:
        return None

    return int(ended_at_ms - started_at_ms)


def _resolve_dagster_home() -> Path:
    configured = os.getenv("DAGSTER_HOME")
    if isinstance(configured, str) and configured.strip():
        return Path(configured).expanduser().resolve()

    conventional = PROJECT_ROOT / "apps" / "dagster" / ".dagster"
    if conventional.exists():
        os.environ["DAGSTER_HOME"] = str(conventional)
        return conventional

    raise RuntimeError(
        "DAGSTER_HOME is not set and apps/dagster/.dagster does not exist. "
        "Configure a Dagster OSS home before reading pipeline status."
    )


def _empty_state_row(step_name: str) -> dict[str, Any]:
    return {
        "state": step_name,
        "expectedCount": 1,
        "writtenCount": 0,
        "pagesFetched": 0,
        "lastSourceId": None,
        "updatedAt": None,
        "isCompleted": False,
    }


def _phase_for_step(step_name: str) -> str:
    if step_name.startswith("raw_"):
        return "extracting"

    if step_name.startswith("canonical_") or step_name.endswith("_tilesource"):
        return "loading"

    if step_name.endswith("_pmtiles"):
        return "building"

    if step_name.endswith("_manifest_publish") or step_name == "validate":
        return "publishing"

    return "extracting"


def _reason_from_tags(tags: dict[str, str]) -> str:
    if "dagster/schedule_name" in tags:
        return "interval"

    if "dagster/sensor_name" in tags:
        return "manual"

    return "manual"


def _latest_run_record(instance: DagsterInstance, dataset: DatasetConfig) -> RunRecord | None:
    records = instance.get_run_records(
        filters=RunsFilter(job_name=dataset.job_name),
        limit=1,
        order_by="update_timestamp",
    )
    return records[0] if records else None


def _build_states(instance: DagsterInstance, run_record: RunRecord, dataset: DatasetConfig) -> tuple[list[dict[str, Any]], list[str], str | None]:
    state_rows = {step.asset_key: _empty_state_row(step.asset_key) for step in dataset.steps}
    step_messages: list[str] = []
    failed_step: str | None = None

    for entry in instance.all_logs(run_record.dagster_run.run_id):
        message = getattr(entry, "user_message", None)
        if isinstance(message, str):
            trimmed_message = message.strip()
            if trimmed_message:
                step_messages.append(trimmed_message)

        dagster_event = getattr(entry, "dagster_event", None)
        if dagster_event is None:
            continue

        step_key = getattr(dagster_event, "step_key", None)
        if step_key not in state_rows:
            continue

        state_row = state_rows[step_key]
        state_row["pagesFetched"] = 1
        updated_at = _to_iso(getattr(entry, "timestamp", None))
        if updated_at is not None:
            state_row["updatedAt"] = updated_at

        event_type = getattr(dagster_event, "event_type_value", "")
        if event_type == "STEP_SUCCESS":
            state_row["writtenCount"] = 1
            state_row["isCompleted"] = True
        elif event_type == "STEP_FAILURE":
            failed_step = step_key

    return list(state_rows.values()), step_messages[-LOG_TAIL_LIMIT:], failed_step


def _current_step(states: list[dict[str, Any]]) -> str | None:
    for state in states:
        if state["isCompleted"] is True:
            continue
        return str(state["state"])

    return None


def _progress_payload(phase: str, states_completed: int, states_total: int, log_tail: list[str]) -> dict[str, Any] | None:
    if phase == "idle" or phase == "failed":
        return None

    progress: dict[str, Any] = {
        "schemaVersion": 1,
        "phase": phase,
    }

    if phase == "building":
        progress["tileBuild"] = {
            "stage": "build",
            "percent": round((states_completed / states_total) * 100, 2) if states_total > 0 else 0,
            "logBytes": sum(len(line.encode("utf-8")) for line in log_tail),
        }
    elif phase == "completed":
        progress["tileBuild"] = {
            "stage": "ready",
            "percent": 100,
            "logBytes": sum(len(line.encode("utf-8")) for line in log_tail),
        }

    return progress


def _idle_snapshot(dataset: DatasetConfig, dagster_home: Path) -> dict[str, Any]:
    states = [_empty_state_row(step.asset_key) for step in dataset.steps]
    return {
        "status": "ok",
        "generatedAt": _iso_now(),
        "enabled": True,
        "mode": "external",
        "intervalMs": POLL_INTERVAL_MS,
        "requireStartupSuccess": False,
        "snapshotRoot": str(dagster_home),
        "latestRunId": None,
        "latestRunCompletedAt": None,
        "run": {
            "runId": None,
            "reason": "manual",
            "phase": "idle",
            "isRunning": False,
            "startedAt": None,
            "endedAt": None,
            "durationMs": None,
            "exitCode": None,
            "summary": None,
            "progress": None,
            "states": states,
            "statesCompleted": 0,
            "statesTotal": len(states),
            "writtenCount": 0,
            "expectedCount": len(states),
            "logTail": [],
        },
    }


def _snapshot_for_run(instance: DagsterInstance, dataset: DatasetConfig, run_record: RunRecord, dagster_home: Path) -> dict[str, Any]:
    states, log_tail, failed_step = _build_states(instance, run_record, dataset)
    dagster_run = run_record.dagster_run
    started_at = _to_iso(run_record.start_time or run_record.create_timestamp)
    ended_at = _to_iso(run_record.end_time)
    states_completed = sum(1 for state in states if state["isCompleted"] is True)
    states_total = len(states)
    run_status = dagster_run.status

    if run_status == DagsterRunStatus.SUCCESS:
        phase = "completed"
        summary = f"completed {states_completed}/{states_total} assets"
        exit_code = 0
    elif run_status == DagsterRunStatus.FAILURE:
        phase = "failed"
        failed_asset = failed_step or _current_step(states) or dataset.steps[-1].asset_key
        summary = f"failed at {failed_asset}"
        exit_code = 1
    else:
        current_step = _current_step(states) or dataset.steps[0].asset_key
        phase = _phase_for_step(current_step)
        summary = f"{phase}:{current_step}"
        exit_code = None

    return {
        "status": "ok",
        "generatedAt": _iso_now(),
        "enabled": True,
        "mode": "external",
        "intervalMs": POLL_INTERVAL_MS,
        "requireStartupSuccess": False,
        "snapshotRoot": str(dagster_home),
        "latestRunId": dagster_run.run_id,
        "latestRunCompletedAt": ended_at,
        "run": {
            "runId": dagster_run.run_id,
            "reason": _reason_from_tags(dagster_run.tags),
            "phase": phase,
            "isRunning": run_status in RUNNING_STATUSES,
            "startedAt": started_at,
            "endedAt": ended_at,
            "durationMs": _duration_ms(started_at, ended_at),
            "exitCode": exit_code,
            "summary": summary,
            "progress": _progress_payload(phase, states_completed, states_total, log_tail),
            "states": states,
            "statesCompleted": states_completed,
            "statesTotal": states_total,
            "writtenCount": states_completed,
            "expectedCount": states_total,
            "logTail": log_tail,
        },
    }


def get_pipeline_status_snapshot(dataset_name: str) -> dict[str, Any]:
    dataset = get_dataset_config(dataset_name)
    dagster_home = _resolve_dagster_home()
    instance = DagsterInstance.get()
    run_record = _latest_run_record(instance, dataset)
    if run_record is None:
        return _idle_snapshot(dataset, dagster_home)

    return _snapshot_for_run(instance, dataset, run_record, dagster_home)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", choices=[dataset.dataset for dataset in DATASETS], required=True)
    args = parser.parse_args(argv)

    try:
        payload = get_pipeline_status_snapshot(args.dataset)
    except Exception as error:  # pragma: no cover - CLI guard
        print(
            json.dumps(
                {
                    "error": str(error),
                }
            ),
            file=sys.stderr,
        )
        return 1

    print(json.dumps(payload))
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
