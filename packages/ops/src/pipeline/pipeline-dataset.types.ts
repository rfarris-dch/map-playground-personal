import type { PipelineDataset } from "@map-migration/contracts";

export interface PipelineCommandSpec {
  readonly args: readonly string[];
  readonly command: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface PipelineCommandFactoryArgs {
  readonly projectRoot: string;
  readonly runId?: string | undefined;
}

export interface TilePipelineRuntimeDataset {
  readonly build: (args: PipelineCommandFactoryArgs) => PipelineCommandSpec;
  readonly dataset: PipelineDataset;
  readonly publish: (args: PipelineCommandFactoryArgs) => PipelineCommandSpec;
  readonly storageDataset: string;
  readonly sync: (args: PipelineCommandFactoryArgs) => PipelineCommandSpec;
}
