export interface SpatialAnalysisOverviewPerspectiveSummary {
  readonly availablePowerMw: number;
  readonly commissionedPowerMw: number;
  readonly count: number;
  readonly leasedCount: number;
  readonly operationalCount: number;
  readonly pipelinePowerMw: number;
  readonly plannedCount: number;
  readonly plannedPowerMw: number;
  readonly squareFootage: number;
  readonly underConstructionCount: number;
  readonly underConstructionPowerMw: number;
  readonly unknownCount: number;
}

export interface SpatialAnalysisOverviewProviderSummary {
  readonly commissionedPowerMw: number;
  readonly count: number;
  readonly providerId?: string;
  readonly providerName: string;
}

export interface SpatialAnalysisOverviewSummary {
  readonly colocation: SpatialAnalysisOverviewPerspectiveSummary;
  readonly hyperscale: SpatialAnalysisOverviewPerspectiveSummary;
  readonly topColocationProviders: readonly SpatialAnalysisOverviewProviderSummary[];
  readonly topHyperscaleProviders: readonly SpatialAnalysisOverviewProviderSummary[];
  readonly totalCount: number;
}

export interface SpatialAnalysisOverviewMetrics {
  readonly averageCommissionedPowerMwPerFacility: number;
  readonly averageSquareFootagePerFacility: number;
  readonly colocationCommissionedPowerMw: number;
  readonly colocationCount: number;
  readonly colocationPipelinePowerMw: number;
  readonly hyperscaleCommissionedPowerMw: number;
  readonly hyperscaleCount: number;
  readonly hyperscalePipelinePowerMw: number;
  readonly totalCommissionedPowerMw: number;
  readonly totalFacilities: number;
  readonly totalPipelinePowerMw: number;
  readonly totalSquareFootage: number;
}

export interface SpatialAnalysisOverviewParcelCandidate {
  readonly acres: number | null;
  readonly address: string | null;
  readonly county: string | null;
  readonly owner: string | null;
  readonly parcelNumber: string | null;
  readonly state: string | null;
}

export interface SpatialAnalysisOverviewParcelCandidateSummary {
  readonly averageAcres: number | null;
  readonly maxAcres: number | null;
  readonly sample: readonly SpatialAnalysisOverviewParcelCandidate[];
  readonly totalAcres: number | null;
}

export interface SpatialAnalysisOverviewStatusItem {
  readonly count: number;
  readonly label: string;
  readonly tone: "amber" | "cyan" | "emerald" | "rose" | "slate";
}
