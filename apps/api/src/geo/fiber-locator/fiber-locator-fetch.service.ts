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

export function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function shouldRetryUpstreamResponse(response: Response): boolean {
  return response.status === 408 || response.status === 429 || response.status >= 500;
}

export function retryDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt);
  return 250 * 2 ** exponent;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return Effect.runPromise(Effect.sleep(ms), signal == null ? undefined : { signal }).catch(
    (error) => {
      if (signal?.aborted) {
        throw createAbortError("fiberlocator tile retry aborted");
      }

      throw error;
    }
  );
}

export function waitForAbortableValue<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (typeof signal === "undefined") {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError("fiberlocator tile request aborted"));
  }

  return Effect.runPromise(
    Effect.tryPromise(() => promise),
    { signal }
  ).catch((error) => {
    if (signal.aborted) {
      throw createAbortError("fiberlocator tile request aborted");
    }

    throw error;
  });
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

function resolveFetchSignal(
  initSignal: AbortSignal | null | undefined,
  effectSignal: AbortSignal
): AbortSignal {
  if (initSignal instanceof AbortSignal) {
    return AbortSignal.any([initSignal, effectSignal]);
  }

  return effectSignal;
}

function fetchResponseEffect(url: string, timeoutMs: number, init: RequestInit = {}) {
  return Effect.tryPromise({
    try: (signal) =>
      fetch(url, {
        ...init,
        signal: resolveFetchSignal(init.signal, signal),
      }),
    catch: (cause) => cause,
  }).pipe(
    Effect.timeoutFail({
      duration: timeoutMs,
      onTimeout: () => createAbortError("fiberlocator upstream request timed out"),
    })
  );
}

export async function fetchWithTimeout(url: string, timeoutMs: number, init: RequestInit = {}) {
  const response = await Effect.runPromise(fetchResponseEffect(url, timeoutMs, init));
  return { response };
}

export async function fetchJsonPayloadWithTimeout(
  url: string,
  timeoutMs: number,
  requestName: string,
  signal?: AbortSignal
): Promise<unknown> {
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  };
  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  const response = await Effect.runPromise(fetchResponseEffect(url, timeoutMs, requestInit));

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
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept,
    },
  };
  if (typeof signal !== "undefined") {
    requestInit.signal = signal;
  }

  let attempt = 0;
  while (attempt < 3) {
    try {
      const { response } = await fetchWithTimeout(url, config.requestTimeoutMs, requestInit);
      if (shouldRetryUpstreamResponse(response) && attempt < 2) {
        response.body?.cancel();
      } else {
        const body = new Uint8Array(await response.arrayBuffer());
        return {
          body,
          cachedAtMs: Date.now(),
          headers: copyTileHeaders(response.headers),
          status: response.status,
          statusText: response.statusText,
        };
      }
    } catch (error) {
      if (attempt >= 2) {
        throw error;
      }
    }

    const waitMs = retryDelayMs(attempt);
    attempt += 1;
    await delay(waitMs, signal);
  }

  throw new Error("fiberlocator tile request exceeded retry attempts");
}
