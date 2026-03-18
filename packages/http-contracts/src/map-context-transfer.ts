import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { MapViewportSchema } from "@map-migration/geo-kernel/map-viewport";
import { z } from "zod";

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

export const MapContextViewportSchema = MapViewportSchema;

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
});

export type MapContextSurface = z.infer<typeof MapContextSurfaceSchema>;
export type MapContextHighlightTarget = z.infer<typeof MapContextHighlightTargetSchema>;
export type MapContextViewport = z.infer<typeof MapContextViewportSchema>;
export type MapContextTransfer = z.infer<typeof MapContextTransferSchema>;
