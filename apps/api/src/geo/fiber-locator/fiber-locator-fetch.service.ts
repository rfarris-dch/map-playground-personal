import {
  createAbortError as createAbortErrorFromEffect,
  fetchResponseEffect,
  runEffectPromise,
  waitForAbortableValue as waitForAbortableValueFromEffect,
} from "@map-migration/core-runtime/effect";
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

export function createAbortError(message: string): Error | DOMException {
  return createAbortErrorFromEffect(message);
}

export function waitForAbortableValue<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  return waitForAbortableValueFromEffect(promise, signal);
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

function fetchResponseWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit = {},
  options: {
    readonly maxAttempts?: number;
    readonly shouldRetryResponse?: (response: Response) => boolean;
  } = {}
): Promise<Response> {
  const signal = init.signal instanceof AbortSignal ? init.signal : undefined;

  return runEffectPromise(
    fetchResponseEffect({
      init,
      retryDelayMs,
      shouldRetryError: (error) =>
        error._tag === "RequestNetworkError" ||
        (error._tag === "RequestAbortedError" && signal?.aborted !== true),
      timeoutMs,
      url,
      ...(typeof options.maxAttempts === "number" ? { maxAttempts: options.maxAttempts } : {}),
      ...(typeof options.shouldRetryResponse === "function"
        ? { shouldRetryResponse: options.shouldRetryResponse }
        : {}),
    }).pipe(Effect.map(({ response }) => response)),
    signal
  );
}

export async function fetchJsonPayloadWithTimeout(
  url: string,
  timeoutMs: number,
  requestName: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetchResponseWithTimeout(url, timeoutMs, {
    headers: {
      accept: "application/json",
    },
    method: "GET",
    ...(typeof signal === "undefined" ? {} : { signal }),
  });

  if (!response.ok) {
    throw new Error(
      `${requestName} request failed (${String(response.status)} ${response.statusText})`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${requestName} response was not valid JSON`);
  }
}

export async function fetchFiberLocatorTileSnapshot(
  config: FiberLocatorConfig,
  url: string,
  accept: string,
  signal?: AbortSignal
): Promise<FiberLocatorTileSnapshot> {
  const response = await fetchResponseWithTimeout(
    url,
    config.requestTimeoutMs,
    {
      headers: {
        accept,
      },
      method: "GET",
      ...(typeof signal === "undefined" ? {} : { signal }),
    },
    {
      maxAttempts: 3,
      shouldRetryResponse: shouldRetryUpstreamResponse,
    }
  );

  return {
    body: new Uint8Array(await response.arrayBuffer()),
    cachedAtMs: Date.now(),
    headers: copyTileHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
  };
}
