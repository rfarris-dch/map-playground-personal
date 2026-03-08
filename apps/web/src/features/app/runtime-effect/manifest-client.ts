import { parseTilePublishManifest, type TilePublishManifest } from "@map-migration/geo-tiles";
import { Effect } from "effect";
import {
  ManifestAbortError,
  ManifestHttpError,
  ManifestJsonParseError,
  ManifestNetworkError,
} from "@/features/app/runtime-effect/errors";

export interface LoadTileManifestArgs {
  readonly fetchImplementation?: typeof fetch;
  readonly manifestPath: string;
  readonly signal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  return Reflect.get(error, "name") === "AbortError";
}

function resolveLocationOrigin(locationOrigin: string | undefined): string {
  if (typeof locationOrigin === "string") {
    return locationOrigin;
  }

  return window.location.origin;
}

export function normalizeManifestPath(manifestPath: string): string {
  if (manifestPath.startsWith("http://") || manifestPath.startsWith("https://")) {
    return manifestPath;
  }

  if (manifestPath.startsWith("/")) {
    return manifestPath;
  }

  return `/${manifestPath}`;
}

export function normalizePmtilesAssetUrl(assetUrl: string, locationOrigin?: string): string {
  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    return assetUrl;
  }

  const normalizedPath = assetUrl.startsWith("/") ? assetUrl : `/${assetUrl}`;
  return `${resolveLocationOrigin(locationOrigin)}${normalizedPath}`;
}

export function loadTileManifestEffect(args: LoadTileManifestArgs) {
  const manifestPath = normalizeManifestPath(args.manifestPath);
  const fetchImplementation = args.fetchImplementation ?? fetch;
  const requestInit: RequestInit = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  };

  if (typeof args.signal !== "undefined") {
    requestInit.signal = args.signal;
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetchImplementation(manifestPath, requestInit),
      catch: (error) =>
        isAbortError(error) ? new ManifestAbortError() : new ManifestNetworkError({ cause: error }),
    });

    if (!response.ok) {
      yield* Effect.fail(
        new ManifestHttpError({
          status: response.status,
          statusText: response.statusText,
        })
      );
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new ManifestJsonParseError(),
    });

    return parseTilePublishManifest(payload);
  });
}

export function createPmtilesSourceUrlFromManifest(
  manifest: TilePublishManifest,
  locationOrigin?: string
): string {
  const absoluteAssetUrl = normalizePmtilesAssetUrl(manifest.current.url, locationOrigin);
  return `pmtiles://${absoluteAssetUrl}`;
}
