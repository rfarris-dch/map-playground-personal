import type { z } from "zod";
import type {
  ParcelAoiSchema,
  ParcelDetailResponseSchema,
  ParcelEnrichRequestSchema,
  ParcelFeatureSchema,
  ParcelGeometryModeSchema,
  ParcelLookupRequestSchema,
  ParcelProfileSchema,
  ParcelResponseMetaSchema,
  ParcelSyncDbLoadProgressSchema,
  ParcelSyncPhaseSchema,
  ParcelSyncProgressSchema,
  ParcelSyncRunReasonSchema,
  ParcelSyncRunStatusSchema,
  ParcelSyncStateProgressSchema,
  ParcelSyncTileBuildProgressSchema,
  ParcelsFeatureCollectionSchema,
  ParcelsSyncStatusResponseSchema,
} from "./parcels-contracts";

export type ParcelsSyncStatusResponse = z.infer<typeof ParcelsSyncStatusResponseSchema>;

export type ParcelSyncRunStatus = z.infer<typeof ParcelSyncRunStatusSchema>;

export type ParcelSyncProgress = z.infer<typeof ParcelSyncProgressSchema>;

export type ParcelSyncTileBuildProgress = z.infer<typeof ParcelSyncTileBuildProgressSchema>;

export type ParcelSyncDbLoadProgress = z.infer<typeof ParcelSyncDbLoadProgressSchema>;

export type ParcelSyncStateProgress = z.infer<typeof ParcelSyncStateProgressSchema>;

export type ParcelSyncRunReason = z.infer<typeof ParcelSyncRunReasonSchema>;

export type ParcelSyncPhase = z.infer<typeof ParcelSyncPhaseSchema>;

export type ParcelEnrichRequest = z.infer<typeof ParcelEnrichRequestSchema>;

export type ParcelLookupRequest = z.infer<typeof ParcelLookupRequestSchema>;

export type ParcelsFeatureCollection = z.infer<typeof ParcelsFeatureCollectionSchema>;

export type ParcelDetailResponse = z.infer<typeof ParcelDetailResponseSchema>;

export type ParcelResponseMeta = z.infer<typeof ParcelResponseMetaSchema>;

export type ParcelFeature = z.infer<typeof ParcelFeatureSchema>;

export type ParcelAoi = z.infer<typeof ParcelAoiSchema>;

export type ParcelProfile = z.infer<typeof ParcelProfileSchema>;

export type ParcelGeometryMode = z.infer<typeof ParcelGeometryModeSchema>;
