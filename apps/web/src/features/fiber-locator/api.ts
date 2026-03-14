import { apiRequestJson } from "@map-migration/core-runtime/api";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import {
  ApiRoutes,
  buildFiberLocatorLayersInViewRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  FiberLocatorCatalogResponseSchema,
  FiberLocatorLayersInViewResponseSchema,
} from "@map-migration/http-contracts/fiber-locator-http";
import type {
  FiberLocatorCatalogFetchResult,
  FiberLocatorInViewFetchResult,
} from "@/features/fiber-locator/fiber-locator.types";

export function fetchFiberLocatorCatalog(): Promise<FiberLocatorCatalogFetchResult> {
  return apiRequestJson(ApiRoutes.fiberLocatorLayers, FiberLocatorCatalogResponseSchema);
}

export function fetchFiberLocatorLayersInView(
  bbox: BBox,
  init: RequestInit = {}
): Promise<FiberLocatorInViewFetchResult> {
  return apiRequestJson(
    buildFiberLocatorLayersInViewRoute(bbox),
    FiberLocatorLayersInViewResponseSchema,
    init
  );
}
