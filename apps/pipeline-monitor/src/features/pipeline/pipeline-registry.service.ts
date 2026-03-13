import {
  getPipelineDatasetDescriptor,
  isPipelineDataset,
  PIPELINE_DATASETS,
  type PipelineDataset,
  type PipelineDatasetDescriptor,
} from "@map-migration/contracts";

export const pipelineDatasets = Object.values(PIPELINE_DATASETS);

export function isKnownPipelineDataset(value: string | null): value is PipelineDataset {
  return isPipelineDataset(value);
}

export function getPipelineDataset(dataset: PipelineDataset): PipelineDatasetDescriptor {
  return getPipelineDatasetDescriptor(dataset);
}
