import { z } from "zod";
import { BBoxSchema } from "./geometry.js";

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
