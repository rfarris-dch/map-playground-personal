import { z } from "zod";

export interface BBox {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

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
export type SourceMode = z.infer<typeof SourceModeSchema>;
export type FacilityPerspective = z.infer<typeof FacilityPerspectiveSchema>;
export type CommissionedSemantic = z.infer<typeof CommissionedSemanticSchema>;
export type LeaseOrOwn = z.infer<typeof LeaseOrOwnSchema>;

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const LongitudeSchema = z.number().finite().min(-180).max(180);
const LatitudeSchema = z.number().finite().min(-90).max(90);

export const ResponseMetaSchema = z.object({
  requestId: z.string().min(1),
  sourceMode: SourceModeSchema,
  dataVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  recordCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(WarningSchema).default([]),
  ingestionRunId: z.string().optional(),
});

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export const ApiErrorResponseSchema = z.object({
  status: z.literal("error"),
  requestId: z.string().min(1),
  error: ApiErrorSchema,
});

export const BBoxSchema = z
  .object({
    west: LongitudeSchema,
    south: LatitudeSchema,
    east: LongitudeSchema,
    north: LatitudeSchema,
  })
  .superRefine((bbox, ctx) => {
    if (bbox.west >= bbox.east) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bbox requires west < east",
        path: ["east"],
      });
    }

    if (bbox.south >= bbox.north) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bbox requires south < north",
        path: ["north"],
      });
    }
  });

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

  const parsed = BBoxSchema.safeParse({ east, north, south, west });
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function formatBboxParam(bbox: BBox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

export function parseFacilityPerspectiveParam(
  value: string | undefined
): FacilityPerspective | null {
  return parseFacilityPerspective(value);
}

export function parseFacilityPerspective(value: unknown): FacilityPerspective | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = FacilityPerspectiveSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function parseCommissionedSemantic(value: unknown): CommissionedSemantic | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = CommissionedSemanticSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function parseLeaseOrOwn(value: unknown): LeaseOrOwn | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = LeaseOrOwnSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export const GeometrySchema = z.object({
  type: z.string(),
  coordinates: z.unknown(),
});

const PolygonCoordinateSchema = z.tuple([LongitudeSchema, LatitudeSchema]);
const PolygonRingSchema = z.array(PolygonCoordinateSchema).min(4);

export const PolygonGeometrySchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(PolygonRingSchema).min(1),
  })
  .superRefine((geometry, ctx) => {
    for (let ringIndex = 0; ringIndex < geometry.coordinates.length; ringIndex += 1) {
      const ring = geometry.coordinates[ringIndex];
      if (typeof ring === "undefined" || ring.length < 4) {
        continue;
      }

      const firstVertex = ring[0];
      const lastVertex = ring.at(-1);
      if (!(firstVertex && lastVertex)) {
        continue;
      }

      if (firstVertex[0] !== lastVertex[0] || firstVertex[1] !== lastVertex[1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "polygon rings must be closed (first vertex must equal last vertex)",
          path: ["coordinates", ringIndex],
        });
      }
    }
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

export const PointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([LongitudeSchema, LatitudeSchema]),
});

export type Warning = z.infer<typeof WarningSchema>;
export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;
