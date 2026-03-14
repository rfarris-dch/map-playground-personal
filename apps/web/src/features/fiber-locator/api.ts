import type { BBox } from "@map-migration/geo-kernel/geometry";
import { ApiRoutes, buildFiberLocatorLayersInViewRoute } from "@map-migration/http-contracts/api-routes";
import { FiberLocatorCatalogResponseSchema, FiberLocatorLayersInViewResponseSchema } from "@map-migration/http-contracts/fiber-locator-http";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FiberLocatorCatalogFetchResult,
  FiberLocatorInViewFetchResult,
} from "@/features/fiber-locator/fiber-locator.types";

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
