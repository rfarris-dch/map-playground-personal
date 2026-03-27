export type SourceRegistrySurfaceScope = "county" | "corridor" | "parcel";

export type SourceRegistryDefaultRole = "primary" | "contextual" | "validation" | "fallback";

export type SourceRegistryPrecisionTier = "A" | "B" | "C";

export type SourceRegistryLaunchCriticality = "blocking" | "gated" | "supporting" | "deferred";

export type SourceRegistryStatus = "active" | "planned" | "deprecated" | "blocked";

export type SourceRegistryApprovalStatus = "approved" | "planned" | "deprecated" | "blocked";

export type SourceRegistryStalenessState = "fresh" | "aging" | "stale" | "critical" | "unknown";

export type SourceRegistryIngestionHealth = "healthy" | "degraded" | "failed" | "not_run";

export type SourceRegistryAccessStatus =
  | "accessible"
  | "cached_only"
  | "lost_access"
  | "pending_renewal"
  | "planned";

export type SourceRegistryRuntimeAlertState = "none" | "warning" | "blocking" | "investigating";

export type SourceRegistryTruthModeCap =
  | "full"
  | "validated_screening"
  | "derived_screening"
  | "context_only"
  | "internal_only";

export type SourceRegistryConfidenceCap = "high" | "medium" | "low";

export type SourceRegistryDownstreamObjectType =
  | "metric"
  | "feature"
  | "score"
  | "surface"
  | "packet_section"
  | "model_input";

export type SourceRegistryRequiredness = "required" | "optional" | "enhancing";

export type SourceRegistrySqlParameterValue =
  | boolean
  | number
  | string
  | Date
  | readonly string[]
  | null;

export interface BunSqlQuery<TValue> extends Promise<TValue> {
  cancel(): BunSqlQuery<TValue>;
  execute(): BunSqlQuery<TValue>;
}

export interface BunSqlClient {
  begin<TValue>(options: string, fn: (sql: BunSqlClient) => Promise<TValue>): Promise<TValue>;
  close(options?: { readonly timeout?: number }): Promise<void>;
  unsafe<TValue = unknown>(
    query: string,
    params?: readonly SourceRegistrySqlParameterValue[]
  ): BunSqlQuery<TValue>;
  <TValue = unknown>(
    strings: TemplateStringsArray,
    ...values: readonly SourceRegistrySqlParameterValue[]
  ): BunSqlQuery<TValue>;
}

export interface SourceRegistryCsvRow {
  readonly [key: string]: string;
}

export interface SourceDefinitionSeedRow {
  readonly codeEntrypoint: string;
  readonly coverageGeography: string;
  readonly coverageGrain: string;
  readonly defaultRole: SourceRegistryDefaultRole;
  readonly description: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly evidenceType: string;
  readonly geometryType: string;
  readonly integrationState: string;
  readonly knownGaps: string;
  readonly launchCriticality: SourceRegistryLaunchCriticality;
  readonly logicalRegistryVersion: string;
  readonly ownerTeam: string;
  readonly precisionTier: SourceRegistryPrecisionTier;
  readonly productionMethod: string;
  readonly providerName: string;
  readonly providerUpdateCadence: string;
  readonly sourceFamily: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: string;
  readonly status: SourceRegistryStatus;
  readonly surfaceScopes: readonly SourceRegistrySurfaceScope[];
}

export interface SourceVersionSeedRow {
  readonly approvalStatus: SourceRegistryApprovalStatus;
  readonly changeNotes: string;
  readonly changeType: string;
  readonly checksumOrFingerprint: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly geographicExtentVersion: string;
  readonly logicalRegistryVersion: string;
  readonly providerVersionLabel: string;
  readonly schemaVersion: string;
  readonly sourceAsOfDate: string | null;
  readonly sourceId: string;
  readonly sourceReleaseDate: string | null;
  readonly sourceVersionId: string;
}

export interface SourceDependencyRuleSeedRow {
  readonly allowedRoles: readonly SourceRegistryDefaultRole[];
  readonly confidenceCap: SourceRegistryConfidenceCap | null;
  readonly degradeIfDaysStale: number | null;
  readonly dependencyRuleId: string;
  readonly downstreamObjectId: string;
  readonly downstreamObjectType: SourceRegistryDownstreamObjectType;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly geographyScope: string;
  readonly logicalRegistryVersion: string;
  readonly precisionTierCAllowedForPrimary: boolean;
  readonly requiredness: SourceRegistryRequiredness;
  readonly roleInDownstream: SourceRegistryDefaultRole;
  readonly sourceId: string;
  readonly suppressIfDaysStale: number | null;
  readonly suppressIfMissing: boolean;
  readonly surfaceScopes: readonly SourceRegistrySurfaceScope[];
  readonly truthModeCap: SourceRegistryTruthModeCap;
  readonly warnIfDaysStale: number | null;
}

export interface SourceRegistrySeedBundle {
  readonly definitions: readonly SourceDefinitionSeedRow[];
  readonly dependencyRules: readonly SourceDependencyRuleSeedRow[];
  readonly logicalRegistryVersion: string;
  readonly versions: readonly SourceVersionSeedRow[];
}

export interface SourceRegistryRuntimeSeedRow {
  readonly accessStatus: SourceRegistryAccessStatus;
  readonly currentRegistryVersion: string;
  readonly currentSourceVersionId: string;
  readonly freshnessAsOf: string | null;
  readonly ingestionHealth: SourceRegistryIngestionHealth;
  readonly lastSuccessfulIngestAt: string | null;
  readonly latestProviderUpdateSeenAt: string | null;
  readonly runtimeAlertState: SourceRegistryRuntimeAlertState;
  readonly sourceId: string;
  readonly stalenessState: SourceRegistryStalenessState;
}

export interface SourceRegistryPublishPaths {
  readonly definitionsCsvPath: string;
  readonly dependencyRulesCsvPath: string;
  readonly versionsCsvPath: string;
}

export interface SourceRegistryPublishOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly projectRoot: string;
  readonly publishedAt?: Date;
  readonly registryVersion?: string | null;
}

export interface SourceRegistryPublishSummary {
  readonly definitionCount: number;
  readonly dependencyRuleCount: number;
  readonly logicalRegistryVersion: string;
  readonly publishedAt: string;
  readonly registryVersion: string;
  readonly runtimeStatusCount: number;
  readonly versionCount: number;
}

export interface SourceRegistryViewCounts {
  readonly activeSources: number;
  readonly currentSourceStatus: number;
  readonly downstreamRules: number;
}
