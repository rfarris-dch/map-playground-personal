import { z } from "zod";

export interface BBox {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

const LongitudeSchema = z.number().finite().min(-180).max(180);
const LatitudeSchema = z.number().finite().min(-90).max(90);

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

  const [west, south, east, north] = parts;

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

export const PolygonCoordinateSchema = z.tuple([LongitudeSchema, LatitudeSchema]);
export const LineStringCoordinateSchema = PolygonCoordinateSchema;
export const PointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([LongitudeSchema, LatitudeSchema]),
});
export const MultiPointGeometrySchema = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(PolygonCoordinateSchema),
});
export const LineStringGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(LineStringCoordinateSchema).min(2),
});
export const MultiLineStringGeometrySchema = z.object({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(LineStringCoordinateSchema).min(2)).min(1),
});
export const PolygonRingSchema = z.array(PolygonCoordinateSchema).min(4);

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

export const MultiPolygonGeometrySchema = z
  .object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(PolygonRingSchema).min(1)).min(1),
  })
  .superRefine((geometry, ctx) => {
    for (let polygonIndex = 0; polygonIndex < geometry.coordinates.length; polygonIndex += 1) {
      const polygon = geometry.coordinates[polygonIndex];
      if (typeof polygon === "undefined") {
        continue;
      }

      for (let ringIndex = 0; ringIndex < polygon.length; ringIndex += 1) {
        const ring = polygon[ringIndex];
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
            path: ["coordinates", polygonIndex, ringIndex],
          });
        }
      }
    }
  });

export const GeometrySchema = z.union([
  PointGeometrySchema,
  MultiPointGeometrySchema,
  LineStringGeometrySchema,
  MultiLineStringGeometrySchema,
  PolygonGeometrySchema,
  MultiPolygonGeometrySchema,
]);

export type PolygonGeometry = z.infer<typeof PolygonGeometrySchema>;
export type PointGeometry = z.infer<typeof PointGeometrySchema>;
export type MultiPointGeometry = z.infer<typeof MultiPointGeometrySchema>;
export type LineStringGeometry = z.infer<typeof LineStringGeometrySchema>;
export type MultiLineStringGeometry = z.infer<typeof MultiLineStringGeometrySchema>;
export type MultiPolygonGeometry = z.infer<typeof MultiPolygonGeometrySchema>;
export type Geometry = z.infer<typeof GeometrySchema>;
