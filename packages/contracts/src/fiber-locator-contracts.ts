import { z } from "zod";
import { ResponseMetaSchema } from "./shared-contracts";

export type {
  FiberLocatorCatalogResponse,
  FiberLocatorLayer,
  FiberLocatorLayersInViewResponse,
} from "./fiber-locator-contracts.types";

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
