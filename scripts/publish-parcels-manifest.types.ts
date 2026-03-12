import type { TileDataset } from "@map-migration/geo-tiles";

export interface CliArgs {
  readonly dataset: TileDataset;
  readonly ingestionRunId: string | null;
  readonly outputRoot: string;
  readonly pmtilesPath: string | null;
  readonly publicBaseUrl: string | null;
  readonly runId: string | null;
  readonly snapshotRoot: string;
  readonly tilesOutDir: string;
}
