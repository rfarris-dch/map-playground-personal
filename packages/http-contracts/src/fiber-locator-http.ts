import { BBoxSchema, parseBboxParam } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

const FIBER_LOCATOR_LAYER_NAME_RE = /^[a-z0-9._-]+$/i;

function decodePathValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function trimValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseDecodedBbox(value: unknown): unknown {
  const decoded = decodePathValue(value);
  if (typeof decoded !== "string") {
    return decoded;
  }

  const parsed = parseBboxParam(decoded);
  return parsed ?? decoded;
}

function parsePathInteger(value: unknown): unknown {
  const normalized = trimValue(value);
  if (typeof normalized === "undefined") {
    return undefined;
  }

  if (typeof normalized === "number") {
    return normalized;
  }

  if (typeof normalized !== "string") {
    return normalized;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

function stripTileSuffix(value: unknown, format: "pbf" | "png"): unknown {
  const decoded = decodePathValue(value);
  if (typeof decoded !== "string") {
    return decoded;
  }

  const trimmed = decoded.trim();
  const suffix = `.${format}`;
  const stripped = trimmed.toLowerCase().endsWith(suffix)
    ? trimmed.slice(0, -suffix.length)
    : trimmed;
  const parsed = Number(stripped);
  return Number.isFinite(parsed) ? parsed : stripped;
}

export const FiberLocatorLayerSchema = z.object({
  layerName: z.string(),
  commonName: z.string(),
  branch: z.string().nullable(),
  geomType: z.string().nullable(),
  color: z.string().nullable(),
});

export const FiberLocatorLayerNameSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().regex(FIBER_LOCATOR_LAYER_NAME_RE));

export const FiberLocatorCatalogResponseSchema = z.object({
  layers: z.array(FiberLocatorLayerSchema),
  meta: ResponseMetaSchema,
});

export const FiberLocatorLayersInViewResponseSchema = z.object({
  layers: z.array(z.string()),
  meta: ResponseMetaSchema,
});

export const FiberLocatorLayersInViewPathSchema = z.object({
  bbox: z.preprocess(parseDecodedBbox, BBoxSchema),
});

export const FiberLocatorTileContentTypeSchema = z.enum(["image/png"]);
export const FiberLocatorVectorTileContentTypeSchema = z.enum([
  "application/vnd.mapbox-vector-tile",
  "application/x-protobuf",
]);

export const FiberLocatorTileRequestSchema = z
  .object({
    format: z.enum(["pbf", "png"]),
    layerName: z.preprocess(decodePathValue, FiberLocatorLayerNameSchema),
    x: z.preprocess(parsePathInteger, z.number().int().nonnegative()),
    y: z.union([
      z.preprocess((value) => stripTileSuffix(value, "png"), z.number().int().nonnegative()),
      z.preprocess((value) => stripTileSuffix(value, "pbf"), z.number().int().nonnegative()),
    ]),
    z: z.preprocess(parsePathInteger, z.number().int().min(0).max(22)),
  })
  .superRefine((request, ctx) => {
    const tileLimit = 2 ** request.z;
    if (request.x >= tileLimit || request.y >= tileLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `x and y must be in range 0..${String(tileLimit - 1)} for z=${String(request.z)}`,
        path: ["x"],
      });
    }
  });

export type FiberLocatorLayer = z.infer<typeof FiberLocatorLayerSchema>;
export type FiberLocatorCatalogResponse = z.infer<typeof FiberLocatorCatalogResponseSchema>;
export type FiberLocatorLayersInViewResponse = z.infer<
  typeof FiberLocatorLayersInViewResponseSchema
>;
export type FiberLocatorLayersInViewPath = z.infer<typeof FiberLocatorLayersInViewPathSchema>;
export type FiberLocatorTileRequest = z.infer<typeof FiberLocatorTileRequestSchema>;
