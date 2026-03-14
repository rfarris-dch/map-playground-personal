import {
  type DatasetLicensingPolicy,
  type ExportGranularity,
  type PolicyDataset,
  type QueryGranularity,
  type SpatialAnalysisPolicy,
  SpatialAnalysisPolicySchema,
} from "@map-migration/http-contracts/analysis-contracts";

const spatialAnalysisPolicyConfig: SpatialAnalysisPolicy = SpatialAnalysisPolicySchema.parse({
  marketMetrics: {
    market_size: {
      key: "market_size",
      canonicalFormula: "SUM(commissioned_power_mw)",
      timeWindow: "trailing_12_month",
      aggregationGrain: "market",
      nullHandling: "exclude",
      owner: "data-platform",
      dueDate: "2026-03-31",
    },
    absorption: {
      key: "absorption",
      canonicalFormula: "AVG(absorption)",
      timeWindow: "quarterly",
      aggregationGrain: "market",
      nullHandling: "exclude",
      owner: "research-analytics",
      dueDate: "2026-03-31",
    },
    vacancy: {
      key: "vacancy",
      canonicalFormula: "AVG(vacancy)",
      timeWindow: "quarterly",
      aggregationGrain: "market",
      nullHandling: "exclude",
      owner: "research-analytics",
      dueDate: "2026-03-31",
    },
  },
  licensing: [
    {
      dataset: "county_scores",
      sensitivityTier: "internal",
      allowedQueryGranularities: ["county"],
      allowedExportGranularities: ["none", "county"],
      minimumKAnonymity: null,
      cacheTtlSeconds: 1800,
      retentionDays: 365,
      redistribution: "internal",
      owner: "research-analytics",
      dueDate: "2026-03-31",
    },
    {
      dataset: "parcels",
      sensitivityTier: "restricted",
      allowedQueryGranularities: ["bbox", "polygon", "county", "tileSet", "parcel"],
      allowedExportGranularities: ["none", "parcel", "county"],
      minimumKAnonymity: 5,
      cacheTtlSeconds: 900,
      retentionDays: 365,
      redistribution: "none",
      owner: "legal-compliance",
      dueDate: "2026-03-31",
    },
    {
      dataset: "facilities",
      sensitivityTier: "internal",
      allowedQueryGranularities: ["bbox", "polygon", "county", "facility", "market"],
      allowedExportGranularities: ["none", "facility", "county", "market"],
      minimumKAnonymity: null,
      cacheTtlSeconds: 300,
      retentionDays: 365,
      redistribution: "internal",
      owner: "product-geo",
      dueDate: "2026-03-31",
    },
    {
      dataset: "environmental_flood",
      sensitivityTier: "internal",
      allowedQueryGranularities: ["polygon"],
      allowedExportGranularities: ["none"],
      minimumKAnonymity: null,
      cacheTtlSeconds: 900,
      retentionDays: 365,
      redistribution: "internal",
      owner: "product-geo",
      dueDate: "2026-03-31",
    },
    {
      dataset: "power",
      sensitivityTier: "internal",
      allowedQueryGranularities: ["county", "state", "country", "bbox"],
      allowedExportGranularities: ["none", "county", "state", "country"],
      minimumKAnonymity: null,
      cacheTtlSeconds: 600,
      retentionDays: 365,
      redistribution: "internal",
      owner: "grid-intelligence",
      dueDate: "2026-03-31",
    },
    {
      dataset: "fiber",
      sensitivityTier: "restricted",
      allowedQueryGranularities: ["bbox", "polygon", "county"],
      allowedExportGranularities: ["none", "county"],
      minimumKAnonymity: 10,
      cacheTtlSeconds: 300,
      retentionDays: 180,
      redistribution: "none",
      owner: "partner-operations",
      dueDate: "2026-03-31",
    },
    {
      dataset: "market_metrics",
      sensitivityTier: "internal",
      allowedQueryGranularities: ["market", "state", "country"],
      allowedExportGranularities: ["none", "market", "state", "country"],
      minimumKAnonymity: null,
      cacheTtlSeconds: 1800,
      retentionDays: 730,
      redistribution: "internal",
      owner: "research-analytics",
      dueDate: "2026-03-31",
    },
  ],
});

function policyForDataset(dataset: PolicyDataset): DatasetLicensingPolicy {
  const policy = spatialAnalysisPolicyConfig.licensing.find((entry) => entry.dataset === dataset);
  if (typeof policy === "undefined") {
    throw new Error(`Spatial policy missing dataset config: ${dataset}`);
  }

  return policy;
}

export function listSpatialAnalysisPolicies(): readonly DatasetLicensingPolicy[] {
  return spatialAnalysisPolicyConfig.licensing;
}

export function isDatasetQueryAllowed(
  dataset: PolicyDataset,
  granularity: QueryGranularity
): boolean {
  const policy = policyForDataset(dataset);
  return policy.allowedQueryGranularities.includes(granularity);
}

export function isDatasetExportAllowed(
  dataset: PolicyDataset,
  granularity: ExportGranularity
): boolean {
  const policy = policyForDataset(dataset);
  return policy.allowedExportGranularities.includes(granularity);
}

export function getDatasetCacheTtlSeconds(dataset: PolicyDataset): number {
  return policyForDataset(dataset).cacheTtlSeconds;
}
