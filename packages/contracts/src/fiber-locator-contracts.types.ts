import type { z } from "zod";
import type {
  FiberLocatorCatalogResponseSchema,
  FiberLocatorLayerSchema,
  FiberLocatorLayersInViewResponseSchema,
} from "./fiber-locator-contracts";

export type FiberLocatorLayersInViewResponse = z.infer<
  typeof FiberLocatorLayersInViewResponseSchema
>;

export type FiberLocatorCatalogResponse = z.infer<typeof FiberLocatorCatalogResponseSchema>;

export type FiberLocatorLayer = z.infer<typeof FiberLocatorLayerSchema>;
