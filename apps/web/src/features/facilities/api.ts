import {
  ApiAbortedError,
  type ApiEffectError,
  type ApiEffectSuccess,
  ApiHttpError,
  ApiNetworkError,
  ApiSchemaError,
  apiRequestJsonEffect,
} from "@map-migration/core-runtime/api";
import {
  buildFacilitiesBboxRoute,
  buildFacilitiesManifestRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesDatasetManifestSchema,
  type FacilitiesFeatureCollection,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/http-contracts/facilities-http";
import { Effect } from "effect";
import { z } from "zod";
import { recordAppPerformanceCounter } from "@/features/app/diagnostics/app-performance.service";
import type { FacilitiesBboxRequest } from "@/features/facilities/facilities.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

declare global {
  var __MAP_FACILITIES_BBOX_REQUESTS__:
    | Map<string, Promise<FacilitiesBboxEffectSuccess>>
    | undefined;
  var __MAP_FACILITIES_DATASET_MANIFEST_CACHE__: FacilitiesDatasetManifestCacheRecord | undefined;
  var __MAP_FACILITIES_DATASET_VERSION_REQUEST__: Promise<string> | null | undefined;
}

const FACILITIES_DATASET_MANIFEST_CACHE_TTL_MS = 30_000;
const facilitiesDatasetManifestStorageKey = "map:facilities-dataset-manifest";

const FacilitiesDatasetManifestCacheRecordSchema = z.object({
  etag: z.string().min(1).optional(),
  expiresAtEpochMs: z.number().finite(),
  manifest: FacilitiesDatasetManifestSchema,
});

type FacilitiesDatasetManifestCacheRecord = z.infer<
  typeof FacilitiesDatasetManifestCacheRecordSchema
>;
type FacilitiesBboxEffectSuccess = ApiEffectSuccess<FacilitiesFeatureCollection>;

function nowEpochMs(): number {
  return Date.now();
}

function isFacilitiesDatasetManifestCacheFresh(
  cacheRecord: FacilitiesDatasetManifestCacheRecord
): boolean {
  return cacheRecord.expiresAtEpochMs >= nowEpochMs();
}

function removePersistedFacilitiesDatasetManifestCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(facilitiesDatasetManifestStorageKey);
}

function readPersistedFacilitiesDatasetManifestCache(): FacilitiesDatasetManifestCacheRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawCacheRecord = window.sessionStorage.getItem(facilitiesDatasetManifestStorageKey);
  if (rawCacheRecord === null) {
    return null;
  }

  try {
    const parsedCacheRecord = FacilitiesDatasetManifestCacheRecordSchema.safeParse(
      JSON.parse(rawCacheRecord)
    );
    if (parsedCacheRecord.success) {
      return parsedCacheRecord.data;
    }
  } catch {
    // Drop corrupted persisted manifest cache and refetch.
  }

  removePersistedFacilitiesDatasetManifestCache();
  return null;
}

function writeCachedFacilitiesDatasetManifest(
  cacheRecord: FacilitiesDatasetManifestCacheRecord
): void {
  globalThis.__MAP_FACILITIES_DATASET_MANIFEST_CACHE__ = cacheRecord;

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(facilitiesDatasetManifestStorageKey, JSON.stringify(cacheRecord));
}

function clearCachedFacilitiesDatasetManifest(): void {
  globalThis.__MAP_FACILITIES_DATASET_MANIFEST_CACHE__ = undefined;
  removePersistedFacilitiesDatasetManifestCache();
}

function readCachedFacilitiesDatasetManifest(): FacilitiesDatasetManifestCacheRecord | null {
  const inMemoryCacheRecord = globalThis.__MAP_FACILITIES_DATASET_MANIFEST_CACHE__;
  if (
    typeof inMemoryCacheRecord !== "undefined" &&
    isFacilitiesDatasetManifestCacheFresh(inMemoryCacheRecord)
  ) {
    return inMemoryCacheRecord;
  }

  const persistedCacheRecord = readPersistedFacilitiesDatasetManifestCache();
  if (
    persistedCacheRecord !== null &&
    isFacilitiesDatasetManifestCacheFresh(persistedCacheRecord)
  ) {
    writeCachedFacilitiesDatasetManifest(persistedCacheRecord);
    return persistedCacheRecord;
  }

  clearCachedFacilitiesDatasetManifest();
  return null;
}

function readStoredFacilitiesDatasetManifest(): FacilitiesDatasetManifestCacheRecord | null {
  const inMemoryCacheRecord = globalThis.__MAP_FACILITIES_DATASET_MANIFEST_CACHE__;
  if (typeof inMemoryCacheRecord !== "undefined") {
    return inMemoryCacheRecord;
  }

  const persistedCacheRecord = readPersistedFacilitiesDatasetManifestCache();
  if (persistedCacheRecord !== null) {
    globalThis.__MAP_FACILITIES_DATASET_MANIFEST_CACHE__ = persistedCacheRecord;
    return persistedCacheRecord;
  }

  return null;
}

function readInflightFacilitiesDatasetVersionRequest(): Promise<string> | null {
  return globalThis.__MAP_FACILITIES_DATASET_VERSION_REQUEST__ ?? null;
}

function writeInflightFacilitiesDatasetVersionRequest(request: Promise<string> | null): void {
  globalThis.__MAP_FACILITIES_DATASET_VERSION_REQUEST__ = request;
}

function readInflightFacilitiesBboxRequests(): Map<string, Promise<FacilitiesBboxEffectSuccess>> {
  const requests = globalThis.__MAP_FACILITIES_BBOX_REQUESTS__;
  if (typeof requests !== "undefined") {
    return requests;
  }

  const nextRequests = new Map<string, Promise<FacilitiesBboxEffectSuccess>>();
  globalThis.__MAP_FACILITIES_BBOX_REQUESTS__ = nextRequests;
  return nextRequests;
}

function toApiEffectError(error: unknown): ApiEffectError {
  if (
    error instanceof ApiAbortedError ||
    error instanceof ApiHttpError ||
    error instanceof ApiNetworkError ||
    error instanceof ApiSchemaError
  ) {
    return error;
  }

  return new ApiNetworkError({
    requestId: "",
    cause: error,
  });
}

function createFacilitiesRequestAbortedError(): ApiAbortedError {
  return new ApiAbortedError({
    requestId: "",
    details: "request aborted",
  });
}

function buildFacilitiesBboxRequestUrl(
  args: FacilitiesBboxRequest,
  datasetVersion: string
): string {
  return buildFacilitiesBboxRoute({
    bbox: args.bbox,
    datasetVersion,
    perspective: args.perspective,
    limit: args.limit,
  });
}

function awaitInflightFacilitiesBboxRequestEffect(
  request: Promise<FacilitiesBboxEffectSuccess>,
  perspective: FacilitiesBboxRequest["perspective"],
  signal?: AbortSignal
) {
  return Effect.tryPromise({
    try: () =>
      new Promise<FacilitiesBboxEffectSuccess>((resolve, reject) => {
        if (signal?.aborted === true) {
          recordAppPerformanceCounter("facilities.request.singleflight.wait-aborted", {
            perspective,
          });
          reject(createFacilitiesRequestAbortedError());
          return;
        }

        const cleanup = () => {
          signal?.removeEventListener("abort", handleAbort);
        };

        const handleAbort = () => {
          cleanup();
          recordAppPerformanceCounter("facilities.request.singleflight.wait-aborted", {
            perspective,
          });
          reject(createFacilitiesRequestAbortedError());
        };

        signal?.addEventListener("abort", handleAbort, { once: true });

        request.then(
          (result) => {
            cleanup();
            resolve(result);
          },
          (error) => {
            cleanup();
            reject(error);
          }
        );
      }),
    catch: toApiEffectError,
  });
}

function fetchFacilitiesByResolvedDatasetVersionEffect(
  args: FacilitiesBboxRequest,
  datasetVersion: string,
  signal?: AbortSignal
) {
  if (signal?.aborted === true) {
    return Effect.fail(createFacilitiesRequestAbortedError());
  }

  const url = buildFacilitiesBboxRequestUrl(args, datasetVersion);
  const inflightRequests = readInflightFacilitiesBboxRequests();
  const existingRequest = inflightRequests.get(url);

  if (typeof existingRequest !== "undefined") {
    recordAppPerformanceCounter("facilities.request.singleflight.joined", {
      perspective: args.perspective,
    });
    return awaitInflightFacilitiesBboxRequestEffect(existingRequest, args.perspective, signal);
  }

  recordAppPerformanceCounter("facilities.request.singleflight.created", {
    perspective: args.perspective,
  });

  const nextRequest = Effect.runPromise(
    apiRequestJsonEffect(url, FacilitiesFeatureCollectionSchema, buildApiRequestInit(), {
      retryProfile: facilitiesInteractiveRetryProfile,
    })
  ).finally(() => {
    const activeRequest = readInflightFacilitiesBboxRequests().get(url);
    if (activeRequest === nextRequest) {
      readInflightFacilitiesBboxRequests().delete(url);
    }
  });

  inflightRequests.set(url, nextRequest);
  return awaitInflightFacilitiesBboxRequestEffect(nextRequest, args.perspective, signal);
}

export function fetchFacilitiesDatasetManifestEffect() {
  return Effect.tryPromise({
    try: async () => {
      const storedManifestCacheRecord = readStoredFacilitiesDatasetManifest();
      const response = await fetch(
        buildFacilitiesManifestRoute(),
        buildApiRequestInit({
          headers:
            typeof storedManifestCacheRecord?.etag === "string"
              ? {
                  "if-none-match": storedManifestCacheRecord.etag,
                }
              : undefined,
        })
      );

      if (response.status === 304) {
        if (storedManifestCacheRecord === null) {
          throw new Error("facilities dataset manifest returned 304 without cached manifest");
        }

        const refreshedCacheRecord: FacilitiesDatasetManifestCacheRecord = {
          ...storedManifestCacheRecord,
          expiresAtEpochMs: nowEpochMs() + FACILITIES_DATASET_MANIFEST_CACHE_TTL_MS,
        };
        writeCachedFacilitiesDatasetManifest(refreshedCacheRecord);
        return refreshedCacheRecord;
      }

      if (!response.ok) {
        throw new Error(
          `facilities dataset manifest request failed: ${String(response.status)} ${response.statusText}`
        );
      }

      const parsedManifest = FacilitiesDatasetManifestSchema.safeParse(await response.json());
      if (!parsedManifest.success) {
        throw parsedManifest.error;
      }

      const responseEtag = response.headers.get("etag");
      const nextCacheRecord: FacilitiesDatasetManifestCacheRecord = {
        manifest: parsedManifest.data,
        ...(typeof responseEtag === "string" && responseEtag.trim().length > 0
          ? { etag: responseEtag.trim() }
          : {}),
        expiresAtEpochMs: nowEpochMs() + FACILITIES_DATASET_MANIFEST_CACHE_TTL_MS,
      };
      writeCachedFacilitiesDatasetManifest(nextCacheRecord);
      return nextCacheRecord;
    },
    catch: (error) =>
      error instanceof Error ? error : new Error("failed to fetch facilities dataset manifest"),
  });
}

function resolveFacilitiesDatasetVersionEffect() {
  const cachedManifest = readCachedFacilitiesDatasetManifest();
  if (cachedManifest !== null) {
    return Effect.succeed(cachedManifest.manifest.current.version);
  }

  const inflightDatasetVersionRequest = readInflightFacilitiesDatasetVersionRequest();
  if (inflightDatasetVersionRequest !== null) {
    return Effect.promise(() => inflightDatasetVersionRequest);
  }

  const nextDatasetVersionRequest = fetchFacilitiesDatasetManifestEffect()
    .pipe(
      Effect.map((result) => result.manifest.current.version),
      Effect.runPromise
    )
    .finally(() => {
      writeInflightFacilitiesDatasetVersionRequest(null);
    });
  writeInflightFacilitiesDatasetVersionRequest(nextDatasetVersionRequest);

  return Effect.promise(() => nextDatasetVersionRequest);
}

const facilitiesInteractiveRetryProfile = {
  maxAttempts: 1,
  retryNetworkErrors: false,
  retryTimeouts: false,
} as const;

export function fetchFacilitiesByBboxEffect(args: FacilitiesBboxRequest, signal?: AbortSignal) {
  const requestedDatasetVersion = args.datasetVersion;

  if (typeof requestedDatasetVersion === "string") {
    return fetchFacilitiesByResolvedDatasetVersionEffect(args, requestedDatasetVersion, signal);
  }

  return resolveFacilitiesDatasetVersionEffect().pipe(
    Effect.flatMap((datasetVersion) =>
      fetchFacilitiesByResolvedDatasetVersionEffect(args, datasetVersion, signal)
    )
  );
}
