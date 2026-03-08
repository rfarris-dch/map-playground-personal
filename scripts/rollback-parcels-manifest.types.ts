import type { TileDataset } from "@map-migration/geo-tiles";

export interface CliArgs {
  readonly dataset: TileDataset;
  readonly outputRoot: string;
}
