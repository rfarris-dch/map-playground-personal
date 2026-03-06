import type { SpatialAnalysisParcelOverview } from "@/features/spatial-analysis/spatial-analysis-overview.service.types";
import { spatialAnalysisParcelFieldValue } from "@/features/spatial-analysis/spatial-analysis-parcels.service";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";

export type { SpatialAnalysisParcelOverview } from "@/features/spatial-analysis/spatial-analysis-overview.service.types";

export function summarizeSpatialAnalysisParcels(
  parcels: readonly SpatialAnalysisParcelRecord[]
): SpatialAnalysisParcelOverview {
  const states = new Set<string>();
  const counties = new Set<string>();

  for (const parcel of parcels) {
    if (parcel.state2 !== null && parcel.state2.length > 0) {
      states.add(parcel.state2);
    }

    const county = spatialAnalysisParcelFieldValue(parcel, "county");
    if (county !== "-") {
      counties.add(county);
    }
  }

  return {
    countyCount: counties.size,
    stateCount: states.size,
  };
}
