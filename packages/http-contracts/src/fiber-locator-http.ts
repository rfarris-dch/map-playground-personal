import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const FiberLocatorLayerSchema = z.object({
  layerName: z.string(),
  commonName: z.string(),
  branch: z.string().nullable(),
  geomType: z.string().nullable(),
  color: z.string().nullable(),
});

export const FiberLocatorCatalogResponseSchema = z.object({
  layers: z.array(FiberLocatorLayerSchema),
  meta: ResponseMetaSchema,
});

export const FiberLocatorLayersInViewResponseSchema = z.object({
  layers: z.array(z.string()),
  meta: ResponseMetaSchema,
});

export type FiberLocatorLayer = z.infer<typeof FiberLocatorLayerSchema>;
export type FiberLocatorCatalogResponse = z.infer<typeof FiberLocatorCatalogResponseSchema>;
export type FiberLocatorLayersInViewResponse = z.infer<
  typeof FiberLocatorLayersInViewResponseSchema
>;
