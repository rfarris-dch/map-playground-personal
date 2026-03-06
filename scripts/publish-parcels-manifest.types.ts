import type { TileDataset } from "@/packages/geo-tiles/src/index";

export interface CliArgs {
  readonly dataset: TileDataset;
  readonly ingestionRunId: string | null;
  readonly outputRoot: string;
  readonly pmtilesPath: string | null;
  readonly runId: string | null;
  readonly snapshotRoot: string;
  readonly tilesOutDir: string;
}
