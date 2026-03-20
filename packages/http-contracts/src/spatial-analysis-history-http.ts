import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { PolygonGeometrySchema } from "@map-migration/geo-kernel/geometry";
import { WarningSchema } from "@map-migration/geo-kernel/warning";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const SpatialAnalysisHistoryRequestSchema = z.object({
  geometry: PolygonGeometrySchema,
  periodLimit: z.number().int().positive().max(40).default(12),
  perspectives: z.array(FacilityPerspectiveSchema).max(2).default(["colocation", "hyperscale"]),
});

export const SpatialAnalysisHistoryPointSchema = z.object({
  colocationAvailableMw: z.number().nonnegative(),
  colocationCommissionedMw: z.number().nonnegative(),
  colocationPlannedMw: z.number().nonnegative(),
  colocationUnderConstructionMw: z.number().nonnegative(),
  facilityCount: z.number().int().nonnegative(),
  hyperscaleOwnedMw: z.number().nonnegative(),
  hyperscalePlannedMw: z.number().nonnegative(),
  hyperscaleUnderConstructionMw: z.number().nonnegative(),
  periodId: z.number().int().nonnegative(),
  periodLabel: z.string().min(1),
  quarterNum: z.number().int().min(1).max(4),
  totalMarketSizeMw: z.number().nonnegative(),
  yearNum: z.number().int(),
});

export const SpatialAnalysisHistorySummarySchema = z.object({
  coverageStatus: z.enum(["complete", "none", "partial"]),
  geometryBasis: z.literal("current"),
  includedColocationFacilityCount: z.number().int().nonnegative(),
  includedFacilityCount: z.number().int().nonnegative(),
  includedHyperscaleFacilityCount: z.number().int().nonnegative(),
  leasedOverlayAvailable: z.boolean(),
  leasedOverlayReason: z.string().nullable(),
  pointCount: z.number().int().nonnegative(),
  points: z.array(SpatialAnalysisHistoryPointSchema),
  publicationBasis: z.literal("live_only"),
  selectedColocationFacilityCount: z.number().int().nonnegative(),
  selectedFacilityCount: z.number().int().nonnegative(),
  selectedHyperscaleFacilityCount: z.number().int().nonnegative(),
  selectedMarketCount: z.number().int().nonnegative(),
  unavailableReason: z.string().nullable(),
});

export const SpatialAnalysisHistoryResponseSchema = z.object({
  meta: ResponseMetaSchema,
  request: SpatialAnalysisHistoryRequestSchema,
  summary: SpatialAnalysisHistorySummarySchema,
  warnings: z.array(WarningSchema),
});

export type SpatialAnalysisHistoryRequest = z.infer<typeof SpatialAnalysisHistoryRequestSchema>;
export type SpatialAnalysisHistoryPoint = z.infer<typeof SpatialAnalysisHistoryPointSchema>;
export type SpatialAnalysisHistorySummary = z.infer<typeof SpatialAnalysisHistorySummarySchema>;
export type SpatialAnalysisHistoryResponse = z.infer<typeof SpatialAnalysisHistoryResponseSchema>;
