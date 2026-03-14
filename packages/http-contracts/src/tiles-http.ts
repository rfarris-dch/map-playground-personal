import { z } from "zod";

function parsePathInteger(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : trimmed;
}

export const UsgsWaterTileContentTypeSchema = z.enum(["image/jpeg", "image/png"]);

export const UsgsWaterTilePathSchema = z.object({
  x: z.preprocess(parsePathInteger, z.number().int().nonnegative()),
  y: z.preprocess(parsePathInteger, z.number().int().nonnegative()),
  z: z.preprocess(parsePathInteger, z.number().int().nonnegative()),
});

export type UsgsWaterTilePath = z.infer<typeof UsgsWaterTilePathSchema>;
