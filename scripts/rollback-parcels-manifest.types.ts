import type { TileDataset } from "@/packages/geo-tiles/src/index";

export interface CliArgs {
  readonly dataset: TileDataset;
  readonly outputRoot: string;
}
