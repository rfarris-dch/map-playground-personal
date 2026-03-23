import { apiRequestJsonEffect } from "@map-migration/core-runtime/api";
import {
  buildFacilitiesBboxRoute,
  buildFacilitiesManifestRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  FacilitiesDatasetManifestSchema,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/http-contracts/facilities-http";
import { Effect } from "effect";
import { z } from "zod";
import type { FacilitiesBboxRequest } from "@/features/facilities/facilities.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

declare global {
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
    return apiRequestJsonEffect(
      buildFacilitiesBboxRoute({
        bbox: args.bbox,
        datasetVersion: requestedDatasetVersion,
        perspective: args.perspective,
        limit: args.limit,
      }),
      FacilitiesFeatureCollectionSchema,
      buildApiRequestInit({ signal }),
      { retryProfile: facilitiesInteractiveRetryProfile }
    );
  }

  return resolveFacilitiesDatasetVersionEffect().pipe(
    Effect.flatMap((datasetVersion) =>
      apiRequestJsonEffect(
        buildFacilitiesBboxRoute({
          bbox: args.bbox,
          datasetVersion,
          perspective: args.perspective,
          limit: args.limit,
        }),
        FacilitiesFeatureCollectionSchema,
        buildApiRequestInit({ signal }),
        { retryProfile: facilitiesInteractiveRetryProfile }
      )
    )
  );
}
