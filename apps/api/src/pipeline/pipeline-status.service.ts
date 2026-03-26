import {
  getPipelineDatasetDescriptor,
  PIPELINE_PLATFORM,
  type PipelineDataset,
  type PipelineStatusResponse,
} from "@map-migration/http-contracts/pipeline-http";
import { getPipelineRunnerStatusSnapshot } from "./pipeline-runner-status.service";

export function getPipelineStatusPayload(dataset: PipelineDataset) {
  return getPipelineRunnerStatusSnapshot(dataset);
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
