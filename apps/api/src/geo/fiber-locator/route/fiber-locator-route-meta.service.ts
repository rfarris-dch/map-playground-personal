import type { ResponseMeta } from "@map-migration/http-contracts/api-response-meta";
import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import { getApiRuntimeConfig } from "@/http/runtime-config";

const PASSTHROUGH_HEADER_NAMES: readonly string[] = [
  "cache-control",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "last-modified",
];

export function buildFiberLocatorResponseMeta(
  requestId: string,
  recordCount: number
): ResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  return {
    requestId,
    sourceMode: runtimeConfig.fiberLocatorSourceMode,
    dataVersion: runtimeConfig.dataVersion,
    generatedAt: new Date().toISOString(),
    recordCount,
    truncated: false,
    warnings: [],
  };
}

export function copyFiberLocatorPassthroughHeaders(upstream: Response, requestId: string): Headers {
  const headers = PASSTHROUGH_HEADER_NAMES.reduce((result, headerName) => {
    const value = upstream.headers.get(headerName);
    if (typeof value === "string") {
      result.set(headerName, value);
    }
    return result;
  }, new Headers());

  headers.set(ApiHeaders.requestId, requestId);
  return headers;
}
