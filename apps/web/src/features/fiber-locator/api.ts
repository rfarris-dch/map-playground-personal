import {
  ApiRoutes,
  type BBox,
  buildFiberLocatorLayersInViewRoute,
  FiberLocatorCatalogResponseSchema,
  FiberLocatorLayersInViewResponseSchema,
} from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type {
  FiberLocatorCatalogFetchResult,
  FiberLocatorInViewFetchResult,
} from "./fiber-locator.types";

export function fetchFiberLocatorCatalog(): Promise<FiberLocatorCatalogFetchResult> {
  return apiGetJson(ApiRoutes.fiberLocatorLayers, FiberLocatorCatalogResponseSchema);
}

export function fetchFiberLocatorLayersInView(
  bbox: BBox,
  init: RequestInit = {}
): Promise<FiberLocatorInViewFetchResult> {
  return apiGetJson(
    buildFiberLocatorLayersInViewRoute(bbox),
    FiberLocatorLayersInViewResponseSchema,
    init
  );
}
