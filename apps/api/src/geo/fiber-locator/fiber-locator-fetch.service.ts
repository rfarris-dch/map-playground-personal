import { fetchResponseEffect, runEffectPromise } from "@map-migration/core-runtime/effect";
import { Effect } from "effect";
import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type { FiberLocatorTileSnapshot } from "./fiber-locator.service.types";

const PASS_THROUGH_TILE_HEADER_NAMES: readonly string[] = [
  "cache-control",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "vary",
];

function shouldRetryUpstreamResponse(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** Math.max(0, attempt);
}

export function copyTileHeaders(headers: Headers): Headers {
  return PASS_THROUGH_TILE_HEADER_NAMES.reduce((copiedHeaders, headerName) => {
    const headerValue = headers.get(headerName);
    if (typeof headerValue === "string") {
      copiedHeaders.set(headerName, headerValue);
    }

    return copiedHeaders;
  }, new Headers());
}

export function createTileSnapshotResponse(snapshot: FiberLocatorTileSnapshot): Response {
  return new Response(snapshot.body.slice(), {
    headers: new Headers(snapshot.headers),
    status: snapshot.status,
    statusText: snapshot.statusText,
  });
}

export async function fetchFiberLocatorTileSnapshot(
  config: FiberLocatorConfig,
  url: string,
  accept: string,
  signal?: AbortSignal
): Promise<FiberLocatorTileSnapshot> {
  const response = await runEffectPromise(
    fetchResponseEffect({
      init: {
        headers: {
          accept,
        },
        method: "GET",
        ...(typeof signal === "undefined" ? {} : { signal }),
      },
      maxAttempts: 3,
      retryDelayMs,
      shouldRetryError: (error) =>
        error._tag === "RequestNetworkError" ||
        (error._tag === "RequestAbortedError" && signal?.aborted !== true),
      shouldRetryResponse: shouldRetryUpstreamResponse,
      timeoutMs: config.requestTimeoutMs,
      url,
    }).pipe(Effect.map(({ response: upstreamResponse }) => upstreamResponse)),
    signal
  );

  return {
    body: new Uint8Array(await response.arrayBuffer()),
    cachedAtMs: Date.now(),
    headers: copyTileHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  };
}
