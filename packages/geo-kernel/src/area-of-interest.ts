import { z } from "zod";
import { BBoxSchema, PolygonGeometrySchema } from "./geometry.js";

export const AreaOfInterestBboxSchema = z.object({
  type: z.literal("bbox"),
  bbox: BBoxSchema,
});

export const AreaOfInterestPolygonSchema = z.object({
  type: z.literal("polygon"),
  geometry: PolygonGeometrySchema,
});

export const AreaOfInterestCountySchema = z.object({
  type: z.literal("county"),
  geoid: z.string().min(1),
});

export const AreaOfInterestTileCoordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const AreaOfInterestTileSetSchema = z.object({
  type: z.literal("tileSet"),
  z: z.number().int().min(0).max(22),
  tiles: z.array(AreaOfInterestTileCoordinateSchema).min(1),
});

export const AreaOfInterestSchema = z
  .discriminatedUnion("type", [
    AreaOfInterestBboxSchema,
    AreaOfInterestPolygonSchema,
    AreaOfInterestCountySchema,
    AreaOfInterestTileSetSchema,
  ])
  .superRefine((aoi, ctx) => {
    if (aoi.type !== "tileSet") {
      return;
    }

    const tileCount = 2 ** aoi.z;
    for (let index = 0; index < aoi.tiles.length; index += 1) {
      const tile = aoi.tiles[index];
      if (typeof tile === "undefined") {
        continue;
      }

      if (tile.x >= tileCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tile x must be in [0, ${String(tileCount - 1)}] for z=${String(aoi.z)}`,
          path: ["tiles", index, "x"],
        });
      }

      if (tile.y >= tileCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `tile y must be in [0, ${String(tileCount - 1)}] for z=${String(aoi.z)}`,
          path: ["tiles", index, "y"],
        });
      }
    }
  });

export type AreaOfInterest = z.infer<typeof AreaOfInterestSchema>;
