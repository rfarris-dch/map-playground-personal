import { describe, expect, it } from "bun:test";
import { DatasetLicensingPolicySchema, SpatialAnalysisPolicySchema } from "@/index";

describe("analysis policy contracts", () => {
  it("accepts a complete spatial-analysis policy payload", () => {
    const parsed = SpatialAnalysisPolicySchema.safeParse({
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
          owner: "data-platform",
          dueDate: "2026-03-31",
        },
        vacancy: {
          key: "vacancy",
          canonicalFormula: "AVG(vacancy)",
          timeWindow: "quarterly",
          aggregationGrain: "market",
          nullHandling: "exclude",
          owner: "data-platform",
          dueDate: "2026-03-31",
        },
      },
      licensing: [
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
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects empty licensing query granularity policy", () => {
    const parsed = DatasetLicensingPolicySchema.safeParse({
      dataset: "parcels",
      sensitivityTier: "restricted",
      allowedQueryGranularities: [],
      allowedExportGranularities: ["none"],
      minimumKAnonymity: 5,
      cacheTtlSeconds: 900,
      retentionDays: 365,
      redistribution: "none",
      owner: "legal-compliance",
      dueDate: "2026-03-31",
    });

    expect(parsed.success).toBe(false);
  });
});
