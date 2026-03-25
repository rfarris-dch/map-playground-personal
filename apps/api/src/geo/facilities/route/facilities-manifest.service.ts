import { createHash } from "node:crypto";
import type { FacilitiesDatasetManifest } from "@map-migration/http-contracts/facilities-http";
import { runQuery } from "@/db/postgres";
import { routeError } from "@/http/effect-route";

const FACILITIES_DATASET_MANIFEST_CACHE_TTL_MS = 5000;

declare global {
  var __MAP_API_FACILITIES_DATASET_MANIFEST_CACHE__:
    | {
        readonly expiresAtEpochMs: number;
        readonly state: FacilitiesDatasetManifestState;
      }
    | undefined;
  var __MAP_API_FACILITIES_DATASET_MANIFEST_REQUEST__:
    | Promise<FacilitiesDatasetManifestState>
    | null
    | undefined;
}

interface FacilitiesDatasetManifestRow {
  readonly current_version: string | null | undefined;
  readonly previous_version: string | null | undefined;
  readonly published_at: Date | string | null | undefined;
  readonly warm_profile_version: string | null | undefined;
}

export interface FacilitiesDatasetManifestState {
  readonly currentVersion: string;
  readonly previousVersion: string | null;
  readonly publishedAt: string;
  readonly warmProfileVersion: string | null;
}

function nowEpochMs(): number {
  return Date.now();
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePublishedAt(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return normalizeText(value);
}

function isMissingFacilitiesManifestRelationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const errno = Reflect.get(error, "errno");
  const message = Reflect.get(error, "message");

  return (
    errno === "42P01" &&
    typeof message === "string" &&
    message.includes('relation "serve.facilities_dataset_manifest" does not exist')
  );
}

function parseFacilitiesDatasetManifestState(
  row: FacilitiesDatasetManifestRow | null
): FacilitiesDatasetManifestState {
  if (row === null) {
    throw routeError({
      httpStatus: 503,
      code: "FACILITIES_DATASET_MANIFEST_UNAVAILABLE",
      message:
        "facilities dataset manifest is unavailable; publish a facilities dataset before serving requests",
    });
  }

  const currentVersion = normalizeText(row.current_version);
  const publishedAt = normalizePublishedAt(row.published_at);
  if (currentVersion === null || publishedAt === null) {
    throw routeError({
      httpStatus: 503,
      code: "FACILITIES_DATASET_MANIFEST_INVALID",
      message: "facilities dataset manifest is invalid",
      details: row,
    });
  }

  return {
    currentVersion,
    previousVersion: normalizeText(row.previous_version),
    publishedAt,
    warmProfileVersion: normalizeText(row.warm_profile_version),
  };
}

function readCachedFacilitiesDatasetManifestState(): FacilitiesDatasetManifestState | null {
  const cacheRecord = globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_CACHE__;
  if (typeof cacheRecord === "undefined") {
    return null;
  }

  if (cacheRecord.expiresAtEpochMs < nowEpochMs()) {
    globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_CACHE__ = undefined;
    return null;
  }

  return cacheRecord.state;
}

function writeCachedFacilitiesDatasetManifestState(state: FacilitiesDatasetManifestState): void {
  globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_CACHE__ = {
    expiresAtEpochMs: nowEpochMs() + FACILITIES_DATASET_MANIFEST_CACHE_TTL_MS,
    state,
  };
}

async function loadFacilitiesDatasetManifestState(
  signal?: AbortSignal
): Promise<FacilitiesDatasetManifestState> {
  const rows = await runQuery<FacilitiesDatasetManifestRow>(
    `
SELECT
  manifest.current_version,
  manifest.previous_version,
  manifest.published_at,
  manifest.warm_profile_version
FROM serve.facilities_dataset_manifest AS manifest
WHERE manifest.dataset = 'facilities'
LIMIT 1;
`,
    [],
    {
      queryClass: "facilities-interactive",
      ...(typeof signal === "undefined" ? {} : { signal }),
    }
  ).catch((error) => {
    if (isMissingFacilitiesManifestRelationError(error)) {
      throw routeError({
        httpStatus: 503,
        code: "FACILITIES_DATASET_MANIFEST_UNAVAILABLE",
        message:
          "facilities dataset manifest is unavailable; publish a facilities dataset before serving requests",
        details: {
          relationName: "serve.facilities_dataset_manifest",
        },
      });
    }

    throw error;
  });

  const state = parseFacilitiesDatasetManifestState(rows[0] ?? null);
  writeCachedFacilitiesDatasetManifestState(state);
  return state;
}

export function clearFacilitiesDatasetManifestStateCache(): void {
  globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_CACHE__ = undefined;
  globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_REQUEST__ = null;
}

export function getFacilitiesDatasetManifestState(
  signal?: AbortSignal
): Promise<FacilitiesDatasetManifestState> {
  const cachedState = readCachedFacilitiesDatasetManifestState();
  if (cachedState !== null) {
    return Promise.resolve(cachedState);
  }

  const inflightRequest = globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_REQUEST__;
  if (inflightRequest instanceof Promise) {
    return inflightRequest;
  }

  const nextRequest = loadFacilitiesDatasetManifestState(signal).finally(() => {
    globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_REQUEST__ = null;
  });
  globalThis.__MAP_API_FACILITIES_DATASET_MANIFEST_REQUEST__ = nextRequest;
  return nextRequest;
}

export function buildFacilitiesDatasetManifest(
  state: FacilitiesDatasetManifestState
): FacilitiesDatasetManifest {
  return {
    dataset: "facilities",
    publishedAt: state.publishedAt,
    current: {
      version: state.currentVersion,
      ...(state.warmProfileVersion === null
        ? {}
        : { warmProfileVersion: state.warmProfileVersion }),
    },
    ...(state.previousVersion === null
      ? {}
      : {
          previous: {
            version: state.previousVersion,
          },
        }),
  };
}

export function buildFacilitiesDatasetManifestEtag(manifest: FacilitiesDatasetManifest): string {
  return `"${createHash("sha1").update(JSON.stringify(manifest)).digest("hex")}"`;
}
