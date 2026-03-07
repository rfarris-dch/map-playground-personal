import { z } from "zod";
import { BBoxSchema, FacilityPerspectiveSchema } from "./shared-contracts";

export type {
  MapContextHighlightTarget,
  MapContextSurface,
  MapContextTransfer,
  MapContextViewport,
} from "./map-context-transfer-contracts.types";

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

export const MapContextViewportSchema = z.union([
  z.object({
    center: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]),
    type: z.literal("center"),
    zoom: z.number().finite().min(0).max(24),
  }),
  z.object({
    bounds: BBoxSchema,
    type: z.literal("bounds"),
  }),
]);

export const MapContextTransferSchema = z.object({
  schemaVersion: z.literal(MAP_CONTEXT_TRANSFER_SCHEMA_VERSION),
  sourceSurface: MapContextSurfaceSchema,
  targetSurface: MapContextSurfaceSchema,
  marketIds: z.array(z.string().min(1)).optional(),
  companyIds: z.array(z.string().min(1)).optional(),
  providerIds: z.array(z.string().min(1)).optional(),
  facilityIds: z.array(z.string().min(1)).optional(),
  activePerspectives: z.array(FacilityPerspectiveSchema).optional(),
  selectedBoundaryIds: z
    .object({
      country: z.array(z.string().min(1)).optional(),
      county: z.array(z.string().min(1)).optional(),
      state: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  viewport: MapContextViewportSchema.optional(),
  selectionGeometryToken: z.string().min(1).optional(),
  highlightTarget: MapContextHighlightTargetSchema.optional(),
  contextToken: z.string().min(1).optional(),
});
