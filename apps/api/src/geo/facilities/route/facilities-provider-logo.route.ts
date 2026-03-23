import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import type { Env, Hono } from "hono";
import { getProviderLogoObject } from "@/geo/facilities/route/facilities-provider-logo.service";
import { resolveRequestId } from "@/http/api-response";
import { matchesIfNoneMatch } from "@/http/conditional-request.service";

export function registerFacilitiesProviderLogoRoute<E extends Env>(app: Hono<E>): void {
  app.get("/api/geo/facilities/provider-logos/:providerId/:fileName", async (c) => {
    const providerId = c.req.param("providerId").trim();
    const fileName = c.req.param("fileName").trim();
    const requestId = resolveRequestId(c, "facilities-logo");

    if (providerId.length === 0 || fileName.length === 0) {
      return new Response("not found", {
        status: 404,
        headers: {
          [ApiHeaders.requestId]: requestId,
        },
      });
    }

    const object = await getProviderLogoObject(providerId, fileName);
    if (object === null) {
      return new Response("not found", {
        status: 404,
        headers: {
          [ApiHeaders.requestId]: requestId,
        },
      });
    }

    const ifNoneMatchHeader = c.req.header("if-none-match");
    if (
      matchesIfNoneMatch({
        etag: object.etag,
        ifNoneMatchHeader,
      })
    ) {
      return new Response(null, {
        status: 304,
        headers: {
          "cache-control": object.cacheControl,
          "content-type": object.contentType,
          [ApiHeaders.requestId]: requestId,
          ETag: object.etag,
        },
      });
    }

    return new Response(Buffer.from(object.body), {
      headers: {
        "cache-control": object.cacheControl,
        "content-type": object.contentType,
        [ApiHeaders.requestId]: requestId,
        ETag: object.etag,
      },
    });
  });
}
