import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type {
  FetchWithTimeoutResult,
  FiberLocatorTileSnapshot,
} from "./fiber-locator.service.types";

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

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      if (typeof signal !== "undefined") {
        signal.removeEventListener("abort", handleAbort);
      }
    };

    const handleAbort = (): void => {
      cleanup();
      reject(createAbortError("fiberlocator tile retry aborted"));
    };

    if (typeof signal !== "undefined") {
      if (signal.aborted) {
        cleanup();
        reject(createAbortError("fiberlocator tile retry aborted"));
        return;
      }

      signal.addEventListener("abort", handleAbort, { once: true });
    }
  });
}

export function waitForAbortableValue<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (typeof signal === "undefined") {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError("fiberlocator tile request aborted"));
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = (): void => {
      signal.removeEventListener("abort", handleAbort);
    };

    const handleAbort = (): void => {
      cleanup();
      reject(createAbortError("fiberlocator tile request aborted"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
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

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init: RequestInit = {}
): Promise<FetchWithTimeoutResult> {
  const timeoutController = new AbortController();
  const externalSignal = init.signal ?? null;

  const onAbort = (): void => {
    timeoutController.abort();
  };

  if (externalSignal !== null) {
    if (externalSignal.aborted) {
      timeoutController.abort();
    }
    externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeoutController.signal,
    });

    return { response };
  } finally {
    clearTimeout(timeoutHandle);
    if (externalSignal !== null) {
      externalSignal.removeEventListener("abort", onAbort);
    }
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
