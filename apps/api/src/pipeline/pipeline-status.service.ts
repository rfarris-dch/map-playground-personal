import {
  getPipelineDatasetDescriptor,
  PIPELINE_PLATFORM,
  type PipelineDataset,
  type PipelineStatusResponse,
} from "@map-migration/contracts";
import { getDagsterPipelineStatusSnapshot } from "./dagster-pipeline-status.service";

export function getPipelineStatusPayload(dataset: PipelineDataset) {
  return getDagsterPipelineStatusSnapshot(dataset);
}

export async function getPipelineStatusResponse(
  dataset: PipelineDataset
): Promise<PipelineStatusResponse> {
  const payload = await getPipelineStatusPayload(dataset);

  return {
    ...payload,
    dataset: getPipelineDatasetDescriptor(dataset),
    platform: PIPELINE_PLATFORM,
  };
}
