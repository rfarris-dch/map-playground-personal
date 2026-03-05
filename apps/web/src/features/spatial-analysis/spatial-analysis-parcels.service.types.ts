import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";

export type ParcelFieldReader = (parcel: SpatialAnalysisParcelRecord) => string;
