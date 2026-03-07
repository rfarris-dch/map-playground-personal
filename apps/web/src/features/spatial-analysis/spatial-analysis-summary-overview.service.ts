import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type {
  SpatialAnalysisOverviewMetrics,
  SpatialAnalysisOverviewParcelCandidate,
  SpatialAnalysisOverviewParcelCandidateSummary,
  SpatialAnalysisOverviewProviderSummary,
  SpatialAnalysisOverviewStatusItem,
  SpatialAnalysisOverviewSummary,
} from "@/features/spatial-analysis/spatial-analysis-summary-overview.types";

export type {
  SpatialAnalysisOverviewMetrics,
  SpatialAnalysisOverviewParcelCandidate,
  SpatialAnalysisOverviewParcelCandidateSummary,
  SpatialAnalysisOverviewProviderSummary,
  SpatialAnalysisOverviewStatusItem,
  SpatialAnalysisOverviewSummary,
} from "@/features/spatial-analysis/spatial-analysis-summary-overview.types";

function toStatusTone(label: string): SpatialAnalysisOverviewStatusItem["tone"] {
  if (label === "Operational") {
    return "emerald";
  }

  if (label === "Under Construction") {
    return "amber";
  }

  if (label === "Planned") {
    return "cyan";
  }

  if (label === "Leased") {
    return "rose";
  }

  return "slate";
}

function toFacilityStatusLabel(facility: SpatialAnalysisFacilityRecord): string {
  const statusLabel = facility.statusLabel?.trim();
  if (typeof statusLabel === "string" && statusLabel.length > 0) {
    return statusLabel;
  }

  if (facility.commissionedSemantic === "under_construction") {
    return "Under Construction";
  }

  if (facility.commissionedSemantic === "planned") {
    return "Planned";
  }

  if (facility.commissionedSemantic === "leased") {
    return "Leased";
  }

  if (facility.commissionedSemantic === "operational") {
    return "Operational";
  }

  return "Unknown";
}

function buildFacilityStatusCounts(
  facilities: readonly SpatialAnalysisFacilityRecord[]
): Map<string, number> {
  return facilities.reduce<Map<string, number>>((lookup, facility) => {
    const statusLabel = toFacilityStatusLabel(facility);
    lookup.set(statusLabel, (lookup.get(statusLabel) ?? 0) + 1);
    return lookup;
  }, new Map<string, number>());
}

function normalizedProviderKey(provider: SpatialAnalysisOverviewProviderSummary): string {
  const providerId = provider.providerId?.trim();
  if (typeof providerId === "string" && providerId.length > 0) {
    return providerId;
  }

  const providerName = provider.providerName.trim();
  if (providerName.length > 0) {
    return providerName.toLocaleLowerCase();
  }

  return "unknown-provider";
}

function readStringAttribute(parcel: SpatialAnalysisParcelRecord, key: string): string | null {
  const value = parcel.attrs[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function readNumberAttribute(parcel: SpatialAnalysisParcelRecord, key: string): number | null {
  const value = parcel.attrs[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function buildSpatialAnalysisOverviewMetrics(
  summary: SpatialAnalysisOverviewSummary
): SpatialAnalysisOverviewMetrics {
  const totalCommissionedPowerMw =
    summary.colocation.commissionedPowerMw + summary.hyperscale.commissionedPowerMw;
  const totalPipelinePowerMw =
    summary.colocation.pipelinePowerMw + summary.hyperscale.pipelinePowerMw;
  const totalFacilities = summary.totalCount;
  const totalSquareFootage = summary.colocation.squareFootage + summary.hyperscale.squareFootage;

  return {
    averageCommissionedPowerMwPerFacility:
      totalFacilities > 0 ? totalCommissionedPowerMw / totalFacilities : 0,
    averageSquareFootagePerFacility: totalFacilities > 0 ? totalSquareFootage / totalFacilities : 0,
    colocationCommissionedPowerMw: summary.colocation.commissionedPowerMw,
    colocationCount: summary.colocation.count,
    colocationPipelinePowerMw: summary.colocation.pipelinePowerMw,
    hyperscaleCommissionedPowerMw: summary.hyperscale.commissionedPowerMw,
    hyperscaleCount: summary.hyperscale.count,
    hyperscalePipelinePowerMw: summary.hyperscale.pipelinePowerMw,
    totalCommissionedPowerMw,
    totalFacilities,
    totalPipelinePowerMw,
    totalSquareFootage,
  };
}

export function buildSpatialAnalysisOverviewStatusItems(
  summary: SpatialAnalysisOverviewSummary,
  facilities?: readonly SpatialAnalysisFacilityRecord[]
): readonly SpatialAnalysisOverviewStatusItem[] {
  if (Array.isArray(facilities) && facilities.length > 0) {
    return [...buildFacilityStatusCounts(facilities).entries()]
      .map(([label, count]) => ({
        label,
        count,
        tone: toStatusTone(label),
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.label.localeCompare(right.label);
      });
  }

  const items: readonly SpatialAnalysisOverviewStatusItem[] = [
    {
      label: "Operational",
      count: summary.colocation.operationalCount + summary.hyperscale.operationalCount,
      tone: "emerald",
    },
    {
      label: "Under Construction",
      count: summary.colocation.underConstructionCount + summary.hyperscale.underConstructionCount,
      tone: "amber",
    },
    {
      label: "Planned",
      count: summary.colocation.plannedCount + summary.hyperscale.plannedCount,
      tone: "cyan",
    },
    {
      label: "Leased",
      count: summary.colocation.leasedCount + summary.hyperscale.leasedCount,
      tone: "rose",
    },
    {
      label: "Unknown",
      count: summary.colocation.unknownCount + summary.hyperscale.unknownCount,
      tone: "slate",
    },
  ];

  return items.filter((item) => item.count > 0);
}

export function buildSpatialAnalysisOverviewProviders(
  summary: SpatialAnalysisOverviewSummary,
  limit = 5
): readonly SpatialAnalysisOverviewProviderSummary[] {
  const providerMap = new Map<
    string,
    {
      commissionedPowerMw: number;
      count: number;
      providerId: string | undefined;
      providerName: string;
    }
  >();

  for (const provider of [
    ...summary.topColocationProviders,
    ...summary.topHyperscaleProviders,
  ] satisfies readonly SpatialAnalysisOverviewProviderSummary[]) {
    const key = normalizedProviderKey(provider);
    const current = providerMap.get(key);
    if (typeof current === "undefined") {
      providerMap.set(key, {
        commissionedPowerMw: provider.commissionedPowerMw,
        count: provider.count,
        providerId: provider.providerId,
        providerName: provider.providerName,
      });
      continue;
    }

    providerMap.set(key, {
      commissionedPowerMw: current.commissionedPowerMw + provider.commissionedPowerMw,
      count: current.count + provider.count,
      providerId: current.providerId ?? provider.providerId,
      providerName:
        current.providerName.trim().length > 0 ? current.providerName : provider.providerName,
    });
  }

  return [...providerMap.values()]
    .sort((left, right) => {
      if (right.commissionedPowerMw !== left.commissionedPowerMw) {
        return right.commissionedPowerMw - left.commissionedPowerMw;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.providerName.localeCompare(right.providerName);
    })
    .map((provider) => {
      if (typeof provider.providerId === "string") {
        return {
          commissionedPowerMw: provider.commissionedPowerMw,
          count: provider.count,
          providerId: provider.providerId,
          providerName: provider.providerName,
        };
      }

      return {
        commissionedPowerMw: provider.commissionedPowerMw,
        count: provider.count,
        providerName: provider.providerName,
      };
    })
    .slice(0, Math.max(1, Math.floor(limit)));
}

export function buildSpatialAnalysisParcelCandidateSummary(
  parcels: readonly SpatialAnalysisParcelRecord[],
  limit = 6
): SpatialAnalysisOverviewParcelCandidateSummary {
  let totalAcres = 0;
  let acreageCount = 0;
  let maxAcres = 0;

  const sample = parcels
    .map<SpatialAnalysisOverviewParcelCandidate>((parcel) => {
      const acres =
        readNumberAttribute(parcel, "ll_gisacre") ?? readNumberAttribute(parcel, "gisacre");
      if (typeof acres === "number") {
        totalAcres += acres;
        acreageCount += 1;
        maxAcres = Math.max(maxAcres, acres);
      }

      return {
        acres,
        address: readStringAttribute(parcel, "address"),
        county: readStringAttribute(parcel, "county"),
        owner: readStringAttribute(parcel, "owner"),
        parcelNumber: readStringAttribute(parcel, "parcelnumb"),
        state: readStringAttribute(parcel, "state2") ?? parcel.state2,
      };
    })
    .sort((left, right) => {
      const leftAcres = left.acres ?? -1;
      const rightAcres = right.acres ?? -1;
      if (rightAcres !== leftAcres) {
        return rightAcres - leftAcres;
      }

      const leftLabel = left.address ?? left.parcelNumber ?? "";
      const rightLabel = right.address ?? right.parcelNumber ?? "";
      return leftLabel.localeCompare(rightLabel);
    })
    .slice(0, Math.max(1, Math.floor(limit)));

  return {
    averageAcres: acreageCount > 0 ? totalAcres / acreageCount : null,
    maxAcres: acreageCount > 0 ? maxAcres : null,
    sample,
    totalAcres: acreageCount > 0 ? totalAcres : null,
  };
}
