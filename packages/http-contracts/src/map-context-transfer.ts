import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { BBoxSchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import {
  CountyPowerStoryIdSchema,
  CountyPowerStoryWindowSchema,
} from "./county-power-story-http.js";

const MapContextCameraSchema = z.object({
  bearing: z.number().finite().min(-180).max(180).optional(),
  pitch: z.number().finite().min(0).max(85).optional(),
});

export const MapViewportSchema = z.union([
  z
    .object({
      center: z.tuple([
        z.number().finite().min(-180).max(180),
        z.number().finite().min(-90).max(90),
      ]),
      type: z.literal("center"),
      zoom: z.number().finite().min(0).max(24),
    })
    .merge(MapContextCameraSchema),
  z
    .object({
      bounds: BBoxSchema,
      type: z.literal("bounds"),
    })
    .merge(MapContextCameraSchema),
]);

export type MapViewport = z.infer<typeof MapViewportSchema>;

export const MAP_CONTEXT_TRANSFER_SCHEMA_VERSION = 1;

export const MapContextSurfaceSchema = z.enum([
  "global-map",
  "market-map",
  "market-dashboard",
  "company-map",
  "company-dashboard",
  "selection-dashboard",
]);

export const MapContextHighlightTargetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["market", "company", "provider", "facility"]),
});

export const MapContextFacilityViewModeSchema = z.enum([
  "bubbles",
  "clusters",
  "dots",
  "heatmap",
  "icons",
]);

/**
 * These now reference the canonical schemas from county-power-story-http
 * instead of duplicating them.
 */
export const MapContextCountyPowerStoryIdSchema = CountyPowerStoryIdSchema;
export const MapContextCountyPowerStoryWindowSchema = CountyPowerStoryWindowSchema;

export const MapContextCountyPowerStoryChapterIdSchema = z.enum([
  "operator-heartbeat",
  "transfer-friction",
  "queue-pressure-storm",
  "transmission-current",
  "policy-shockwaves",
  "county-scan",
]);

export const MapContextCountyPowerStoryVisibilitySchema = z.object({
  animationEnabled: z.boolean(),
  chapterId: MapContextCountyPowerStoryChapterIdSchema,
  chapterVisible: z.boolean(),
  seamHazeEnabled: z.boolean(),
  storyId: MapContextCountyPowerStoryIdSchema,
  threeDimensional: z.boolean(),
  visible: z.boolean(),
  window: MapContextCountyPowerStoryWindowSchema,
});

export const MapContextViewportSchema = MapViewportSchema;

export const MapContextFiltersSchema = z.object({
  activeMarkets: z.array(z.string().min(1)).optional(),
  activeUsers: z.array(z.string().min(1)).optional(),
  facilityProviders: z.array(z.string().min(1)).optional(),
  facilityStatuses: z
    .array(z.enum(["commissioned", "under-construction", "planned", "unknown"]))
    .optional(),
  floodZones: z.array(z.string().min(1)).optional(),
  gasCapacities: z.array(z.string().min(1)).optional(),
  gasStatuses: z.array(z.string().min(1)).optional(),
  interconnectivityHub: z.boolean().optional(),
  parcelDataset: z.string().optional(),
  parcelDavPercent: z.string().optional(),
  parcelStyleAcres: z.string().optional(),
  powerTypes: z.array(z.string().min(1)).optional(),
  transmissionMinVoltage: z.number().finite().nonnegative().optional(),
  zoningTypes: z.array(z.string().min(1)).optional(),
});

export const MapContextTransferSchema = z.object({
  schemaVersion: z.literal(MAP_CONTEXT_TRANSFER_SCHEMA_VERSION),
  sourceSurface: MapContextSurfaceSchema,
  targetSurface: MapContextSurfaceSchema,
  marketIds: z.array(z.string().min(1)).optional(),
  companyIds: z.array(z.string().min(1)).optional(),
  providerIds: z.array(z.string().min(1)).optional(),
  facilityIds: z.array(z.string().min(1)).optional(),
  activePerspectives: z.array(FacilityPerspectiveSchema).optional(),
  facilityViewModes: z
    .object({
      colocation: MapContextFacilityViewModeSchema.optional(),
      hyperscale: MapContextFacilityViewModeSchema.optional(),
    })
    .optional(),
  countyPowerStoryVisibility: MapContextCountyPowerStoryVisibilitySchema.optional(),
  visibleLayerIds: z.array(z.string().min(1)).optional(),
  visibleBasemapLayerIds: z.array(z.string().min(1)).optional(),
  selectedBoundaryIds: z
    .object({
      country: z.array(z.string().min(1)).optional(),
      county: z.array(z.string().min(1)).optional(),
      state: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  selectedFiberSourceLayerNames: z
    .object({
      longhaul: z.array(z.string().min(1)).optional(),
      metro: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  viewport: MapContextViewportSchema.optional(),
  selectionGeometryToken: z.string().min(1).optional(),
  highlightTarget: MapContextHighlightTargetSchema.optional(),
  contextToken: z.string().min(1).optional(),
  mapFilters: MapContextFiltersSchema.optional(),
});

export type MapContextSurface = z.infer<typeof MapContextSurfaceSchema>;
export type MapContextHighlightTarget = z.infer<typeof MapContextHighlightTargetSchema>;
export type MapContextViewport = z.infer<typeof MapContextViewportSchema>;
export type MapContextTransfer = z.infer<typeof MapContextTransferSchema>;
export type MapContextFilters = z.infer<typeof MapContextFiltersSchema>;
