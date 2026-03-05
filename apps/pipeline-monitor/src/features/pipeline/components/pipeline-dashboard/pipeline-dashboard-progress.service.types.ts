export interface RunProgressAccumulator {
  readonly expectedCount: number;
  readonly hasExpectedGap: boolean;
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly writtenCount: number;
}
