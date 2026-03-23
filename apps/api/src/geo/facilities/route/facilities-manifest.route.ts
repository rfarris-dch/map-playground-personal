import { ApiHeaders, ApiRoutes } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesDatasetManifest,
  FacilitiesDatasetManifestSchema,
} from "@map-migration/http-contracts/facilities-http";
import type { Env, Hono } from "hono";
import { getFacilitiesProtectedCacheVary } from "@/geo/facilities/route/facilities-cache.service";
import { jsonOk, withHeaders } from "@/http/api-response";
import { matchesIfNoneMatch } from "@/http/conditional-request.service";
import { fromApiRequest, runEffectRoute } from "@/http/effect-route";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import {
  buildFacilitiesDatasetManifest,
  buildFacilitiesDatasetManifestEtag,
  getFacilitiesDatasetManifestState,
} from "./facilities-manifest.service";

function getFacilitiesManifestCacheControl(): string {
  return "public, max-age=30, s-maxage=30, stale-while-revalidate=60, stale-if-error=60";
}

export function registerFacilitiesManifestRoute<E extends Env>(app: Hono<E>): void {
  app.get(ApiRoutes.facilitiesManifest, (c) =>
    runEffectRoute(
      c,
      fromApiRequest(async ({ honoContext, requestId, signal }) => {
        const runtimeConfig = getApiRuntimeConfig();
        const manifestState = await getFacilitiesDatasetManifestState(signal);
        const payload: FacilitiesDatasetManifest = buildFacilitiesDatasetManifest(manifestState);
        const etag = buildFacilitiesDatasetManifestEtag(payload);
        const cacheControl = getFacilitiesManifestCacheControl();

        if (
          matchesIfNoneMatch({
            etag,
            ifNoneMatchHeader: honoContext.req.header("if-none-match"),
          })
        ) {
          return new Response(null, {
            status: 304,
            headers: {
              "Cache-Control": cacheControl,
              [ApiHeaders.dataVersion]: runtimeConfig.dataVersion,
              [ApiHeaders.datasetVersion]: manifestState.currentVersion,
              [ApiHeaders.requestId]: requestId,
              ETag: etag,
              Vary: getFacilitiesProtectedCacheVary(),
            },
          });
        }

        return withHeaders(
          jsonOk(honoContext, FacilitiesDatasetManifestSchema, payload, requestId),
          {
            "Cache-Control": cacheControl,
            [ApiHeaders.dataVersion]: runtimeConfig.dataVersion,
            [ApiHeaders.datasetVersion]: manifestState.currentVersion,
            ETag: etag,
            Vary: getFacilitiesProtectedCacheVary(),
          }
        );
      })
    )
  );
}
