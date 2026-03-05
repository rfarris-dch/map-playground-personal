export interface SyncStateArgs {
  readonly acreageWhereClause: string;
  readonly expectedCount: number;
  readonly getToken: (minValiditySeconds?: number) => Promise<string>;
  readonly maxPagesPerState: number | null;
  readonly objectIdField: string;
  readonly pageSize: number;
  readonly resume: boolean;
  readonly runDir: string;
  readonly state2: string;
  readonly tieBreakerField: string | null;
}

export interface StateSyncCounters {
  lastSourceId: number | null;
  lastTieBreakerId: number | null;
  pagesFetched: number;
  writtenCount: number;
}

export interface SyncRunSummary {
  readonly acreageField: string;
  readonly completedAt: string;
  readonly featureLayerUrl: string;
  readonly minimumAcres: number;
  readonly pageSize: number;
  readonly runId: string;
  readonly startedAt: string;
  readonly stateConcurrency: number;
  readonly states: readonly StateProgress[];
  readonly tokenExpiresInSeconds: number;
}

export interface StateProgress {
  readonly expectedCount: number;
  readonly isCompleted: boolean;
  readonly lastSourceId: number | null;
  readonly lastTieBreakerId: number | null;
  readonly pagesFetched: number;
  readonly state: string;
  readonly writtenCount: number;
}

export interface ArcgisLayerMetadata {
  readonly fields: readonly unknown[];
  readonly name: string;
  readonly objectIdField: string;
}

export interface ArcgisQueryErrorPayload {
  readonly code: number | null;
  readonly message: string;
}

export interface ArcgisCountResponse {
  readonly count: number;
}

export interface ArcgisQueryResponse {
  readonly features: readonly ArcgisQueryFeature[];
}

export interface ArcgisQueryFeature {
  readonly attributes: Record<string, unknown>;
  readonly geometry?: unknown;
}

export interface ArcgisTokenProvider {
  getLatestExpiresInSeconds(): number;
  getToken(minValiditySeconds?: number): Promise<string>;
}

export interface ArcgisTokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
}

export interface CliArgs {
  readonly maxPagesPerState: number | null;
  readonly minimumAcres: number;
  readonly outputDir: string;
  readonly pageSize: number;
  readonly resume: boolean;
  readonly runId: string;
  readonly stateConcurrency: number;
  readonly states: readonly string[];
}
