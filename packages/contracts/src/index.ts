import { z } from "zod";

export const SourceModeSchema = z.enum(["pmtiles", "postgis", "arcgis-proxy", "external-xyz"]);
export const FacilityPerspectiveSchema = z.enum(["colocation", "hyperscale"]);
export const CommissionedSemanticSchema = z.enum([
  "leased",
  "operational",
  "under_construction",
  "planned",
  "unknown",
]);
export const LeaseOrOwnSchema = z.enum(["lease", "own", "unknown"]);

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ResponseMetaSchema = z.object({
  sourceMode: SourceModeSchema,
  dataVersion: z.string(),
  generatedAt: z.string().datetime(),
  recordCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(WarningSchema).default([]),
  ingestionRunId: z.string().optional(),
});

export type SourceMode = z.infer<typeof SourceModeSchema>;
export type FacilityPerspective = z.infer<typeof FacilityPerspectiveSchema>;
export type CommissionedSemantic = z.infer<typeof CommissionedSemanticSchema>;
export type LeaseOrOwn = z.infer<typeof LeaseOrOwnSchema>;
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

export interface BBox {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export function parseBboxParam(value: string): BBox | null {
  const rawParts = value.split(",").map((part) => part.trim());
  if (rawParts.length !== 4) {
    return null;
  }

  if (rawParts.some((part) => part.length === 0)) {
    return null;
  }

  const parts = rawParts.map((part) => Number(part));
  if (parts.length !== 4) {
    return null;
  }

  const west = parts[0];
  const south = parts[1];
  const east = parts[2];
  const north = parts[3];

  if (
    typeof west === "undefined" ||
    typeof south === "undefined" ||
    typeof east === "undefined" ||
    typeof north === "undefined"
  ) {
    return null;
  }

  if (![west, south, east, north].every((item) => Number.isFinite(item))) {
    return null;
  }

  if (west >= east || south >= north) {
    return null;
  }

  if (west < -180 || east > 180 || south < -90 || north > 90) {
    return null;
  }

  return { east, north, south, west };
}

export function formatBboxParam(bbox: BBox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

export function parseFacilityPerspectiveParam(
  value: string | undefined
): FacilityPerspective | null {
  if (typeof value === "undefined") {
    return null;
  }

  const parsed = FacilityPerspectiveSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export const GeometrySchema = z.object({
  type: z.string(),
  coordinates: z.unknown(),
});

export const FeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: z.record(z.unknown()),
});

export const FeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FeatureSchema),
  meta: ResponseMetaSchema,
});

export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;

export const PointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

export const FacilitiesPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  providerId: z.string(),
  countyFips: z.string(),
  commissionedPowerMw: z.number().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
});

export const FacilitiesFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]),
  geometry: PointGeometrySchema,
  properties: FacilitiesPropertiesSchema,
});

export const FacilitiesFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FacilitiesFeatureSchema),
  meta: ResponseMetaSchema,
});

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;

export const FacilitiesDetailPropertiesSchema = z.object({
  perspective: FacilityPerspectiveSchema,
  facilityId: z.string(),
  providerId: z.string(),
  countyFips: z.string(),
  commissionedSemantic: CommissionedSemanticSchema,
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  commissionedPowerMw: z.number().nullable(),
  plannedPowerMw: z.number().nullable(),
  underConstructionPowerMw: z.number().nullable(),
  availablePowerMw: z.number().nullable(),
});

export const FacilitiesDetailFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]),
  geometry: PointGeometrySchema,
  properties: FacilitiesDetailPropertiesSchema,
});

export const FacilitiesDetailResponseSchema = z.object({
  feature: FacilitiesDetailFeatureSchema,
  meta: ResponseMetaSchema,
});

export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;
export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;

export const HealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  now: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthSchema>;

export interface ApiDefaultsTable {
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
}

export interface ApiHeadersTable {
  readonly requestId: string;
}

export interface ApiRoutesTable {
  readonly facilities: string;
  readonly health: string;
}

export const ApiRoutes = Object.freeze<ApiRoutesTable>({
  health: "/api/health",
  facilities: "/api/geo/facilities",
});

export function buildFacilityDetailRoute(facilityId: string): string {
  return `${ApiRoutes.facilities}/${encodeURIComponent(facilityId)}`;
}

export const ApiHeaders = Object.freeze<ApiHeadersTable>({
  requestId: "x-request-id",
});

export const ApiDefaults = Object.freeze<ApiDefaultsTable>({
  dataVersion: "dev",
  facilitiesSourceMode: "postgis",
});
