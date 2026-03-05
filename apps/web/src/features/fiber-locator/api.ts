import {
  ApiRoutes,
  type BBox,
  buildFiberLocatorLayersInViewRoute,
  FiberLocatorCatalogResponseSchema,
  FiberLocatorLayersInViewResponseSchema,
} from "@map-migration/contracts";
import type {
  FiberLocatorCatalogFetchResult,
  FiberLocatorInViewFetchResult,
} from "@/features/fiber-locator/fiber-locator.types";
import { apiGetJson } from "@/lib/api-client";

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
