import { join } from "node:path";
import {
  getPipelineDatasetDescriptor,
  isPipelineDataset,
  type PipelineDataset,
} from "@map-migration/contracts";
import type { PipelineCommandSpec, TilePipelineRuntimeDataset } from "./pipeline-dataset.types";

function buildBashCommand(scriptPath: string, runId?: string): PipelineCommandSpec {
  return {
    command: "bash",
    args: typeof runId === "string" ? [scriptPath, runId] : [scriptPath],
  };
}

function buildBunCommand(
  scriptPath: string,
  scriptArgs: readonly string[],
  env?: Readonly<Record<string, string | undefined>>
): PipelineCommandSpec {
  return {
    command: "bun",
    args: ["run", scriptPath, ...scriptArgs],
    ...(typeof env === "undefined" ? {} : { env }),
  };
}

const PIPELINE_RUNTIME_DATASETS = Object.freeze<
  Record<PipelineDataset, TilePipelineRuntimeDataset>
>({
  parcels: {
    dataset: "parcels",
    storageDataset: getPipelineDatasetDescriptor("parcels").storageDataset,
    sync: ({ projectRoot }) => buildBashCommand(join(projectRoot, "scripts/refresh-parcels.sh")),
    build: ({ projectRoot, runId }) =>
      buildBashCommand(join(projectRoot, "scripts/build-parcels-draw-pmtiles.sh"), runId),
    publish: ({ projectRoot, runId }) =>
      buildBunCommand(join(projectRoot, "scripts/publish-parcels-manifest.ts"), [
        "--dataset=parcels-draw-v1",
        ...(typeof runId === "string" ? [`--run-id=${runId}`] : []),
      ]),
  },
  flood: {
    dataset: "flood",
    storageDataset: getPipelineDatasetDescriptor("flood").storageDataset,
    sync: ({ projectRoot }) => ({
      command: "bash",
      args: [join(projectRoot, "scripts/refresh-environmental-sync.sh")],
      env: {
        ENVIRONMENTAL_SYNC_DATASET: "environmental-flood",
      },
    }),
    build: ({ projectRoot, runId }) =>
      buildBashCommand(join(projectRoot, "scripts/build-environmental-flood-pmtiles.sh"), runId),
    publish: ({ projectRoot, runId }) =>
      buildBunCommand(join(projectRoot, "scripts/publish-parcels-manifest.ts"), [
        "--dataset=environmental-flood",
        ...(typeof runId === "string" ? [`--run-id=${runId}`] : []),
      ]),
  },
  "hydro-basins": {
    dataset: "hydro-basins",
    storageDataset: getPipelineDatasetDescriptor("hydro-basins").storageDataset,
    sync: ({ projectRoot }) => ({
      command: "bash",
      args: [join(projectRoot, "scripts/refresh-environmental-sync.sh")],
      env: {
        ENVIRONMENTAL_SYNC_DATASET: "environmental-hydro-basins",
      },
    }),
    build: ({ projectRoot, runId }) =>
      buildBashCommand(
        join(projectRoot, "scripts/build-environmental-hydro-basins-pmtiles.sh"),
        runId
      ),
    publish: ({ projectRoot, runId }) =>
      buildBunCommand(join(projectRoot, "scripts/publish-parcels-manifest.ts"), [
        "--dataset=environmental-hydro-basins",
        ...(typeof runId === "string" ? [`--run-id=${runId}`] : []),
      ]),
  },
});

export function listTilePipelineRuntimeDatasets(): readonly TilePipelineRuntimeDataset[] {
  return Object.values(PIPELINE_RUNTIME_DATASETS);
}

export function getTilePipelineRuntimeDataset(
  dataset: PipelineDataset
): TilePipelineRuntimeDataset {
  return PIPELINE_RUNTIME_DATASETS[dataset];
}

export function isRuntimePipelineDataset(
  value: string | null | undefined
): value is PipelineDataset {
  return isPipelineDataset(value);
}
