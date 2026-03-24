export type CountyPowerBundleVersion = "county-power-v1";
export interface CountyPowerSourceDescriptor {
  readonly path: string;
  readonly recordCount: number;
  readonly sourceAsOfDate: string;
  readonly sourceName: string;
  readonly sourceUri: string;
  readonly sourceVersion: string;
}
export type CountyPowerConfidenceClass =
  | "consultant"
  | "derived"
  | "ian_adjusted"
  | "official"
  | "unknown";
export type InterconnectionQueueStageGroup =
  | "active_study"
  | "committed"
  | "construction"
  | "early_planning"
  | "operational"
  | "permitting_or_approval"
  | "suspended_or_unknown"
  | "withdrawn";
export interface CountyPowerBundleManifestDatasets {
  readonly congestion: CountyPowerSourceDescriptor;
  readonly countyFipsAliases: CountyPowerSourceDescriptor;
  readonly countyOperatorRegions: CountyPowerSourceDescriptor;
  readonly countyOperatorZones: CountyPowerSourceDescriptor;
  readonly fiber: CountyPowerSourceDescriptor;
  readonly gas: CountyPowerSourceDescriptor;
  readonly gridFriction: CountyPowerSourceDescriptor;
  readonly operatorRegions: CountyPowerSourceDescriptor;
  readonly operatorZoneReferences: CountyPowerSourceDescriptor;
  readonly policyEvents: CountyPowerSourceDescriptor;
  readonly policySnapshots: CountyPowerSourceDescriptor;
  readonly powerMarketContext: CountyPowerSourceDescriptor;
  readonly queueCountyResolutions: CountyPowerSourceDescriptor;
  readonly queuePoiReferences: CountyPowerSourceDescriptor;
  readonly queueProjects: CountyPowerSourceDescriptor;
  readonly queueResolutionOverrides: CountyPowerSourceDescriptor;
  readonly queueSnapshots: CountyPowerSourceDescriptor;
  readonly queueUnresolved: CountyPowerSourceDescriptor;
  readonly transmission: CountyPowerSourceDescriptor;
  readonly utilityContext: CountyPowerSourceDescriptor;
}
export interface CountyPowerBundleManifest {
  readonly bundleVersion: CountyPowerBundleVersion;
  readonly datasets: CountyPowerBundleManifestDatasets;
  readonly dataVersion: string;
  readonly effectiveDate: string;
  readonly generatedAt: string;
  readonly month: string;
}
export interface CountyPowerUtilityEntry {
  readonly retailChoiceStatus:
    | "bundled_monopoly"
    | "choice"
    | "mixed"
    | "partial_choice"
    | "unknown";
  readonly territoryType: string | null;
  readonly utilityId: string | null;
  readonly utilityName: string | null;
}
export interface CountyConstraintSummaryEntry {
  readonly constraintId: string;
  readonly flowMw: number | null;
  readonly hoursBound: number | null;
  readonly label: string;
  readonly limitMw: number | null;
  readonly operator: string | null;
  readonly shadowPrice: number | null;
  readonly voltageKv: number | null;
}
export interface CountyFipsAliasRecord {
  readonly aliasCountyFips: string;
  readonly aliasKind: string;
  readonly canonicalCountyFips: string;
}
export interface CountyOperatorRegionRecord {
  readonly confidenceClass: CountyPowerConfidenceClass;
  readonly mappingMethod: string;
  readonly marketStructure: "mixed" | "organized_market" | "traditional_vertical" | "unknown";
  readonly operatorRegion: string;
  readonly owner: string;
  readonly sourceArtifact: string;
  readonly sourceVersion: string | null;
}
export interface CountyOperatorRegionBridgeRecord {
  readonly allocationShare: number;
  readonly confidenceClass: CountyPowerConfidenceClass;
  readonly countyFips: string;
  readonly isBorderCounty: boolean;
  readonly isPrimaryRegion: boolean;
  readonly isSeamCounty: boolean;
  readonly mappingMethod: string;
  readonly marketStructure: "mixed" | "organized_market" | "traditional_vertical" | "unknown";
  readonly operatorRegion: string;
  readonly owner: string;
  readonly sourceArtifact: string;
  readonly sourceVersion: string | null;
}
export interface InterconnectionQueueProjectRecord {
  readonly countyFips: string | null;
  readonly fuelType: string | null;
  readonly latestSourceAsOfDate: string | null;
  readonly marketId: string | null;
  readonly modelVersion?: string;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueCountyConfidence: "high" | "low" | "medium" | null;
  readonly queueName: string | null;
  readonly queuePoiLabel: string | null;
  readonly queueResolverType: string | null;
  readonly sourceSystem: string;
  readonly stageGroup: InterconnectionQueueStageGroup | null;
  readonly stateAbbrev: string | null;
}
export interface InterconnectionQueueCountyResolutionRecord {
  readonly allocationShare: number;
  readonly countyFips: string;
  readonly marketId: string | null;
  readonly projectId: string;
  readonly queuePoiLabel: string | null;
  readonly resolverConfidence: "high" | "low" | "medium";
  readonly resolverType: string;
  readonly sourceLocationLabel: string | null;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface InterconnectionQueueSnapshotRecord {
  readonly capacityMw: number | null;
  readonly completionPrior: number | null;
  readonly countyFips: string | null;
  readonly daysInQueueActive: number | null;
  readonly expectedOperationDate: string | null;
  readonly isPastDue: boolean | null;
  readonly marketId: string | null;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueDate: string | null;
  readonly queueStatus: string | null;
  readonly signedIa: boolean | null;
  readonly sourceSystem: string;
  readonly stageGroup: InterconnectionQueueStageGroup | null;
  readonly stateAbbrev: string | null;
  readonly transmissionUpgradeCostUsd: number | null;
  readonly transmissionUpgradeCount: number | null;
  readonly withdrawalPrior: number | null;
}
export interface CountyOperatorZoneReferenceRecord {
  readonly confidenceClass: CountyPowerConfidenceClass | null;
  readonly operator: string;
  readonly operatorZoneConfidence: "high" | "low" | "medium" | null;
  readonly operatorZoneLabel: string;
  readonly operatorZoneType: string;
  readonly owner: string;
  readonly referenceName: string | null;
  readonly resolutionMethod: string;
  readonly sourceArtifact: string | null;
  readonly sourceVersion: string | null;
  readonly stateAbbrev: string | null;
}
export interface CountyOperatorZoneBridgeRecord {
  readonly allocationShare: number;
  readonly confidenceClass: CountyPowerConfidenceClass | null;
  readonly countyFips: string;
  readonly isPrimarySubregion: boolean;
  readonly operator: string;
  readonly operatorZoneConfidence: "high" | "low" | "medium" | null;
  readonly operatorZoneLabel: string;
  readonly operatorZoneType: string;
  readonly owner: string;
  readonly resolutionMethod: string;
  readonly sourceArtifact: string | null;
  readonly sourceVersion: string | null;
}
export interface QueuePoiReferenceRecord {
  readonly countyFips: string;
  readonly operator: string | null;
  readonly operatorZoneLabel: string | null;
  readonly operatorZoneType: string | null;
  readonly queuePoiLabel: string;
  readonly resolutionMethod: string;
  readonly resolverConfidence: "high" | "low" | "medium";
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface QueueResolutionOverrideRecord {
  readonly allocationShare: number;
  readonly countyFips: string;
  readonly matcherType: string;
  readonly matcherValue: string;
  readonly notes: string | null;
  readonly resolverConfidence: "high" | "low" | "medium";
  readonly resolverType: string;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface CountyGridFrictionRecord {
  readonly confidence: string | null;
  readonly congestionProxyScore: number | null;
  readonly countyFips: string;
  readonly heatmapSignalAvailable: boolean | null;
  readonly marketWithdrawalPrior: number | null;
  readonly medianDaysInQueueActive: number | null;
  readonly pastDueShare: number | null;
  readonly plannedTransmissionUpgradeCount: number | null;
  readonly statusMix: Readonly<Record<string, number>>;
}
export interface CountyGasRecord {
  readonly countyFips: string;
  readonly gasPipelineMileageCounty: number | null;
  readonly gasPipelinePresenceFlag: boolean | null;
}
export interface CountyFiberRecord {
  readonly countyFips: string;
  readonly fiberPresenceFlag: boolean | null;
}
export interface CountyPowerMarketContextRecord {
  readonly balancingAuthority: string | null;
  readonly countyFips: string;
  readonly loadZone: string | null;
  readonly marketStructure: "mixed" | "organized_market" | "traditional_vertical" | "unknown";
  readonly meteoZone: string | null;
  readonly operatorWeatherZone: string | null;
  readonly operatorZoneConfidence: "high" | "low" | "medium" | null;
  readonly operatorZoneLabel: string | null;
  readonly operatorZoneType: string | null;
  readonly weatherZone: string | null;
  readonly wholesaleOperator: string | null;
}
export interface CountyUtilityContextRecord {
  readonly competitiveAreaType:
    | "bundled"
    | "choice"
    | "co_op"
    | "mixed"
    | "muni"
    | "noie"
    | "unknown";
  readonly countyFips: string;
  readonly dominantUtilityId: string | null;
  readonly dominantUtilityName: string | null;
  readonly primaryTduOrUtility: string | null;
  readonly retailChoicePenetrationShare: number | null;
  readonly retailChoiceStatus:
    | "bundled_monopoly"
    | "choice"
    | "mixed"
    | "partial_choice"
    | "unknown";
  readonly territoryType: string | null;
  readonly utilities: readonly CountyPowerUtilityEntry[];
  readonly utilityCount: number | null;
}
export interface CountyTransmissionRecord {
  readonly countyFips: string;
  readonly miles69kvPlus: number | null;
  readonly miles138kvPlus: number | null;
  readonly miles230kvPlus: number | null;
  readonly miles345kvPlus: number | null;
  readonly miles500kvPlus: number | null;
  readonly miles765kvPlus: number | null;
}
export interface CountyCongestionRecord {
  readonly avgRtCongestionComponent: number | null;
  readonly countyFips: string;
  readonly negativePriceHourShare: number | null;
  readonly p95ShadowPrice: number | null;
  readonly topConstraints: readonly CountyConstraintSummaryEntry[];
}
export interface CountyPolicyEventRecord {
  readonly affectedSitingDimension: string | null;
  readonly confidenceClass: CountyPowerConfidenceClass | null;
  readonly countyFips: string | null;
  readonly eventDate: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly evidenceSummary: string;
  readonly jurisdictionKey: string | null;
  readonly jurisdictionLevel: string | null;
  readonly marketId: string | null;
  readonly moratoriumStatus: string | null;
  readonly policyDirection: string | null;
  readonly policyStatus: string | null;
  readonly policyType: string | null;
  readonly sentimentDirection: string | null;
  readonly sourceUrl: string | null;
  readonly stateAbbrev: string | null;
  readonly title: string;
}
export interface InterconnectionQueueUnresolvedRecord {
  readonly candidateCountyFips: readonly string[];
  readonly manualReviewFlag: boolean;
  readonly marketId: string | null;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueName: string | null;
  readonly queuePoiLabel: string | null;
  readonly rawLocationLabel: string | null;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
  readonly unresolvedReason: string;
}
export interface CountyPolicySnapshotRecord {
  readonly countyFips: string;
  readonly countyTaggedEventShare: number | null;
  readonly moratoriumStatus: "active" | "none" | "unknown" | "watch";
  readonly policyConstraintScore: number | null;
  readonly policyEventCount: number | null;
  readonly policyMappingConfidence: "high" | "low" | "medium" | null;
  readonly policyMomentumScore: number | null;
  readonly publicSentimentScore: number | null;
}
export interface CountyPowerNormalizedBundle {
  readonly congestion: readonly CountyCongestionRecord[];
  readonly countyFipsAliases: readonly CountyFipsAliasRecord[];
  readonly countyOperatorRegions: readonly CountyOperatorRegionBridgeRecord[];
  readonly countyOperatorZones: readonly CountyOperatorZoneBridgeRecord[];
  readonly fiber: readonly CountyFiberRecord[];
  readonly gas: readonly CountyGasRecord[];
  readonly gridFriction: readonly CountyGridFrictionRecord[];
  readonly manifest: CountyPowerBundleManifest;
  readonly operatorRegions: readonly CountyOperatorRegionRecord[];
  readonly operatorZoneReferences: readonly CountyOperatorZoneReferenceRecord[];
  readonly policyEvents: readonly CountyPolicyEventRecord[];
  readonly policySnapshots: readonly CountyPolicySnapshotRecord[];
  readonly powerMarketContext: readonly CountyPowerMarketContextRecord[];
  readonly queueCountyResolutions: readonly InterconnectionQueueCountyResolutionRecord[];
  readonly queuePoiReferences: readonly QueuePoiReferenceRecord[];
  readonly queueProjects: readonly InterconnectionQueueProjectRecord[];
  readonly queueResolutionOverrides: readonly QueueResolutionOverrideRecord[];
  readonly queueSnapshots: readonly InterconnectionQueueSnapshotRecord[];
  readonly queueUnresolved: readonly InterconnectionQueueUnresolvedRecord[];
  readonly transmission: readonly CountyTransmissionRecord[];
  readonly utilityContext: readonly CountyUtilityContextRecord[];
}
export interface CountyPowerRunContext {
  readonly latestRunPointerPath: string;
  readonly normalizedDir: string;
  readonly normalizedManifestPath: string;
  readonly rawDir: string;
  readonly rawManifestPath: string;
  readonly runConfigPath: string;
  readonly runDir: string;
  readonly runId: string;
  readonly runSummaryPath: string;
  readonly snapshotRoot: string;
}
export interface CountyPowerRunConfig {
  readonly createdAt: string;
  readonly dataVersion: string | null;
  readonly effectiveDate: string | null;
  readonly manifestPath?: string;
  readonly manifestUrl?: string;
  readonly month: string | null;
  readonly options: Readonly<Record<string, string>>;
  readonly runId: string;
}
export interface CountyPowerLoadCounts {
  readonly congestion: number;
  readonly countyFipsAliases: number;
  readonly countyOperatorRegions: number;
  readonly countyOperatorZones: number;
  readonly fiber: number;
  readonly gas: number;
  readonly gridFriction: number;
  readonly operatorRegions: number;
  readonly operatorZoneReferences: number;
  readonly policyEvents: number;
  readonly policySnapshots: number;
  readonly powerMarketContext: number;
  readonly queueCountyResolutions: number;
  readonly queuePoiReferences: number;
  readonly queueProjects: number;
  readonly queueResolutionOverrides: number;
  readonly queueSnapshots: number;
  readonly queueUnresolved: number;
  readonly transmission: number;
  readonly utilityContext: number;
}
export interface CountyPowerLoadPayload {
  readonly congestion: readonly CountyPowerCongestionDbRow[];
  readonly countyFipsAliases: readonly CountyPowerCountyFipsAliasDbRow[];
  readonly countyOperatorRegions: readonly CountyPowerCountyOperatorRegionDbRow[];
  readonly countyOperatorZones: readonly CountyPowerCountyOperatorZoneDbRow[];
  readonly fiber: readonly CountyPowerFiberDbRow[];
  readonly gas: readonly CountyPowerGasDbRow[];
  readonly gridFriction: readonly CountyPowerGridFrictionDbRow[];
  readonly manifest: CountyPowerBundleManifest;
  readonly operatorRegions: readonly CountyPowerOperatorRegionDbRow[];
  readonly operatorZoneReferences: readonly CountyPowerOperatorZoneReferenceDbRow[];
  readonly policyEvents: readonly CountyPowerPolicyEventDbRow[];
  readonly policySnapshots: readonly CountyPowerPolicySnapshotDbRow[];
  readonly powerMarketContext: readonly CountyPowerMarketContextDbRow[];
  readonly queueCountyResolutions: readonly CountyPowerQueueCountyResolutionDbRow[];
  readonly queuePoiReferences: readonly CountyPowerQueuePoiReferenceDbRow[];
  readonly queueProjects: readonly CountyPowerQueueProjectDbRow[];
  readonly queueResolutionOverrides: readonly CountyPowerQueueResolutionOverrideDbRow[];
  readonly queueSnapshots: readonly CountyPowerQueueSnapshotDbRow[];
  readonly queueUnresolved: readonly CountyPowerQueueUnresolvedDbRow[];
  readonly transmission: readonly CountyPowerTransmissionDbRow[];
  readonly utilityContext: readonly CountyPowerUtilityContextDbRow[];
}
export interface CountyPowerLoadOptions {
  readonly modelVersion: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerMarketContextDbRow {
  readonly balancingAuthority: string | null;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly loadZone: string | null;
  readonly marketStructure: string | null;
  readonly meteoZone: string | null;
  readonly modelVersion: string;
  readonly month: string;
  readonly operatorWeatherZone: string | null;
  readonly operatorZoneConfidence: string | null;
  readonly operatorZoneLabel: string | null;
  readonly operatorZoneType: string | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly weatherZone: string | null;
  readonly wholesaleOperator: string | null;
}
export interface CountyPowerCountyFipsAliasDbRow {
  readonly aliasCountyGeoid: string;
  readonly aliasKind: string;
  readonly canonicalCountyGeoid: string;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerOperatorZoneReferenceDbRow {
  readonly confidenceClass: string | null;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly operator: string;
  readonly operatorZoneConfidence: string | null;
  readonly operatorZoneLabel: string;
  readonly operatorZoneType: string;
  readonly owner: string;
  readonly referenceName: string | null;
  readonly resolutionMethod: string;
  readonly sourceArtifact: string | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceVersion: string | null;
  readonly stateAbbrev: string | null;
}
export interface CountyPowerOperatorRegionDbRow {
  readonly confidenceClass: string;
  readonly effectiveDate: string;
  readonly mappingMethod: string;
  readonly marketStructure: string;
  readonly modelVersion: string;
  readonly operatorRegion: string;
  readonly owner: string;
  readonly sourceArtifact: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceVersion: string | null;
}
export interface CountyPowerCountyOperatorRegionDbRow {
  readonly allocationShare: number;
  readonly confidenceClass: string;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly isBorderCounty: boolean;
  readonly isPrimaryRegion: boolean;
  readonly isSeamCounty: boolean;
  readonly mappingMethod: string;
  readonly marketStructure: string;
  readonly modelVersion: string;
  readonly operatorRegion: string;
  readonly owner: string;
  readonly sourceArtifact: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceVersion: string | null;
}
export interface CountyPowerCountyOperatorZoneDbRow {
  readonly allocationShare: number;
  readonly confidenceClass: string | null;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly isPrimarySubregion: boolean;
  readonly modelVersion: string;
  readonly operator: string;
  readonly operatorZoneConfidence: string | null;
  readonly operatorZoneLabel: string;
  readonly operatorZoneType: string;
  readonly owner: string;
  readonly resolutionMethod: string;
  readonly sourceArtifact: string | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceVersion: string | null;
}
export interface CountyPowerUtilityContextDbRow {
  readonly competitiveAreaType: string | null;
  readonly countyGeoid: string;
  readonly dominantUtilityId: string | null;
  readonly dominantUtilityName: string | null;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly month: string;
  readonly primaryTduOrUtility: string | null;
  readonly retailChoicePenetrationShare: number | null;
  readonly retailChoiceStatus: string | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly territoryType: string | null;
  readonly utilitiesJson: string;
  readonly utilityCount: number | null;
}
export interface CountyPowerTransmissionDbRow {
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly miles69kvPlus: number | null;
  readonly miles138kvPlus: number | null;
  readonly miles230kvPlus: number | null;
  readonly miles345kvPlus: number | null;
  readonly miles500kvPlus: number | null;
  readonly miles765kvPlus: number | null;
  readonly modelVersion: string;
  readonly month: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerCongestionDbRow {
  readonly avgRtCongestionComponent: number | null;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly month: string;
  readonly negativePriceHourShare: number | null;
  readonly p95ShadowPrice: number | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly topConstraintsJson: string;
}
export interface CountyPowerGridFrictionDbRow {
  readonly confidence: string | null;
  readonly congestionProxyScore: number | null;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly heatmapSignalAvailable: boolean | null;
  readonly marketWithdrawalPrior: number | null;
  readonly medianDaysInQueueActive: number | null;
  readonly modelVersion: string;
  readonly month: string;
  readonly pastDueShare: number | null;
  readonly plannedTransmissionUpgradeCount: number | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly statusMixJson: string;
}
export interface CountyPowerGasDbRow {
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly gasPipelineMileageCounty: number | null;
  readonly gasPipelinePresenceFlag: boolean | null;
  readonly modelVersion: string;
  readonly month: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerFiberDbRow {
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly fiberPresenceFlag: boolean | null;
  readonly modelVersion: string;
  readonly month: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerPolicyEventDbRow {
  readonly affectedSitingDimension: string | null;
  readonly confidenceClass: string | null;
  readonly countyGeoid: string | null;
  readonly effectiveDate: string;
  readonly eventDate: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly evidenceSummary: string;
  readonly jurisdictionKey: string | null;
  readonly jurisdictionLevel: string | null;
  readonly marketId: string | null;
  readonly modelVersion: string;
  readonly moratoriumStatus: string | null;
  readonly policyDirection: string | null;
  readonly policyStatus: string | null;
  readonly policyType: string | null;
  readonly sentimentDirection: string | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceUrl: string | null;
  readonly stateAbbrev: string | null;
  readonly title: string;
}
export interface CountyPowerPolicySnapshotDbRow {
  readonly countyGeoid: string;
  readonly countyTaggedEventShare: number | null;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly month: string;
  readonly moratoriumStatus: string | null;
  readonly policyConstraintScore: number | null;
  readonly policyEventCount: number | null;
  readonly policyMappingConfidence: string | null;
  readonly policyMomentumScore: number | null;
  readonly publicSentimentScore: number | null;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
}
export interface CountyPowerQueueProjectDbRow {
  readonly countyGeoid: string | null;
  readonly fuelType: string | null;
  readonly latestSourceAsOfDate: string | null;
  readonly marketId: string | null;
  readonly modelVersion: string;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueCountyConfidence: string | null;
  readonly queueName: string | null;
  readonly queuePoiLabel: string | null;
  readonly queueResolverType: string | null;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stageGroup: string | null;
  readonly stateAbbrev: string | null;
}
export interface CountyPowerQueueCountyResolutionDbRow {
  readonly allocationShare: number;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly marketId: string | null;
  readonly modelVersion: string;
  readonly projectId: string;
  readonly queuePoiLabel: string | null;
  readonly resolverConfidence: string;
  readonly resolverType: string;
  readonly sourceAsOfDate: string | null;
  readonly sourceLocationLabel: string | null;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface CountyPowerQueuePoiReferenceDbRow {
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly modelVersion: string;
  readonly operator: string | null;
  readonly operatorZoneLabel: string | null;
  readonly operatorZoneType: string | null;
  readonly queuePoiLabel: string;
  readonly resolutionMethod: string;
  readonly resolverConfidence: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface CountyPowerQueueResolutionOverrideDbRow {
  readonly allocationShare: number;
  readonly countyGeoid: string;
  readonly effectiveDate: string;
  readonly matcherType: string;
  readonly matcherValue: string;
  readonly modelVersion: string;
  readonly notes: string | null;
  readonly resolverConfidence: string;
  readonly resolverType: string;
  readonly sourceAsOfDate: string;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
}
export interface CountyPowerQueueSnapshotDbRow {
  readonly capacityMw: number | null;
  readonly completionPrior: number | null;
  readonly countyGeoid: string | null;
  readonly daysInQueueActive: number | null;
  readonly effectiveDate: string;
  readonly expectedOperationDate: string | null;
  readonly isPastDue: boolean | null;
  readonly marketId: string | null;
  readonly modelVersion: string;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueDate: string | null;
  readonly queueStatus: string | null;
  readonly signedIa: boolean | null;
  readonly snapshotRunId: string;
  readonly sourceAsOfDate: string | null;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stageGroup: string | null;
  readonly stateAbbrev: string | null;
  readonly transmissionUpgradeCostUsd: number | null;
  readonly transmissionUpgradeCount: number | null;
  readonly withdrawalPrior: number | null;
}
export interface CountyPowerQueueUnresolvedDbRow {
  readonly candidateCountiesJson: string;
  readonly effectiveDate: string;
  readonly manualReviewFlag: boolean;
  readonly marketId: string | null;
  readonly modelVersion: string;
  readonly nativeStatus: string | null;
  readonly projectId: string;
  readonly queueName: string | null;
  readonly queuePoiLabel: string | null;
  readonly rawLocationLabel: string | null;
  readonly sourceAsOfDate: string | null;
  readonly sourcePullTimestamp: string;
  readonly sourceSystem: string;
  readonly stateAbbrev: string | null;
  readonly unresolvedReason: string;
}
export interface CountyPowerMaterializedManifest {
  readonly localManifestPath: string;
  readonly manifest: CountyPowerBundleManifest;
  readonly manifestPath: string | null;
  readonly manifestUrl: string | null;
}
//# sourceMappingURL=county-power-sync.types.d.ts.map
