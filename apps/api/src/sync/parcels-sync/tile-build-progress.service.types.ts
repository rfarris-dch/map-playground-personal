export interface TileBuildWorkProgress {
  readonly stage: "read" | "write";
  readonly workDone: number;
  readonly workLeft: number;
  readonly workTotal: number;
}
