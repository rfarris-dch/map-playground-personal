#!/usr/bin/env bun
import { runPipeline } from "../packages/ops/src/etl/pipeline-runner";
import type {
  PipelineRunnerDataset,
  PipelineRunnerReason,
} from "../packages/ops/src/etl/pipeline-runner.types";

function parseArg(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const rawArg of process.argv.slice(2)) {
    if (rawArg.startsWith(prefix)) {
      return rawArg.slice(prefix.length);
    }
  }

  return undefined;
}

function resolveDataset(value: string | undefined): PipelineRunnerDataset {
  if (value === "flood" || value === "hydro-basins" || value === "parcels") {
    return value;
  }

  throw new Error("Missing required argument --dataset=parcels|flood|hydro-basins");
}

function resolveReason(value: string | undefined): PipelineRunnerReason | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "interval" || value === "manual" || value === "startup" || value === "unknown") {
    return value;
  }

  throw new Error("Invalid --reason value. Use startup|interval|manual|unknown.");
}

const dataset = resolveDataset(parseArg("--dataset"));
const runId = parseArg("--run-id");
const reason = resolveReason(parseArg("--reason"));

try {
  const result = await runPipeline({
    dataset,
    ...(runId === undefined ? {} : { runId }),
    ...(reason === undefined ? {} : { reason }),
  });

  console.log(
    `[pipeline-runner] completed dataset=${dataset} runId=${result.runId} snapshotRoot=${result.snapshotRoot}`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pipeline-runner] ${message}`);
  process.exit(1);
}
