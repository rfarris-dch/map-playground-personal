import type { ParcelAoi, Warning } from "@map-migration/geo-kernel";
import {
  ApiHeaders,
  type ParcelGeometryMode,
  ParcelGeometryModeSchema,
  type ParcelProfile,
  ParcelProfileSchema,
  type ParcelResponseMeta,
  type ParcelsFeatureCollection,
} from "@map-migration/http-contracts";
import type { Context } from "hono";
import { parseBooleanFlag } from "@/config/env-parsing.service";
import { rejectWithConflict } from "@/geo/parcels/route/parcels-route-errors.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
export const EXPOSE_SYNC_INTERNALS = parseBooleanFlag(process.env.EXPOSE_SYNC_INTERNALS, false);

export function parseIncludeGeometryParam(
  value: string | undefined,
  fallback: ParcelGeometryMode
): ParcelGeometryMode | null {
  if (typeof value === "undefined") {
    return fallback;
  }

  const parsed = ParcelGeometryModeSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function parseProfileParam(
  value: string | undefined,
  fallback: ParcelProfile
): ParcelProfile | null {
  if (typeof value === "undefined") {
    return fallback;
  }

  const parsed = ParcelProfileSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function sanitizeWarnings(warnings: readonly Warning[]): Warning[] {
  return warnings.map((warning) => ({
    code: warning.code,
    message: warning.message,
  }));
}

export function buildParcelMeta(args: {
  readonly requestId: string;
  readonly profile: ParcelProfile;
  readonly includeGeometry: ParcelGeometryMode;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
  readonly aoiType?: ParcelAoi["type"];
  readonly nextCursor?: string | null;
  readonly ingestionRunId: string | undefined;
}): ParcelResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  const meta: ParcelResponseMeta = {
    requestId: args.requestId,
    sourceMode: runtimeConfig.parcelsSourceMode,
    dataVersion: runtimeConfig.dataVersion,
    generatedAt: new Date().toISOString(),
    profile: args.profile,
    includeGeometry: args.includeGeometry,
    recordCount: args.recordCount,
    truncated: args.truncated,
    warnings: sanitizeWarnings(args.warnings),
  };

  if (typeof args.aoiType !== "undefined") {
    meta.aoiType = args.aoiType;
  }

  if (typeof args.nextCursor !== "undefined") {
    meta.nextCursor = args.nextCursor;
  }

  if (typeof args.ingestionRunId === "string" && args.ingestionRunId.trim().length > 0) {
    meta.ingestionRunId = args.ingestionRunId;
  }

  return meta;
}

export function profileMetadataWarnings(profile: ParcelProfile): Warning[] {
  if (profile !== "full_170") {
    return [];
  }

  return [
    {
      code: "PROFILE_METADATA_ONLY",
      message: "profile currently does not alter payload shape and is treated as metadata-only",
    },
  ];
}

export function readIngestionRunId(
  features: ParcelsFeatureCollection["features"]
): string | undefined {
  let resolvedIngestionRunId: string | undefined;

  for (const feature of features) {
    const ingestionRunId = feature.lineage.ingestionRunId;
    if (typeof ingestionRunId !== "string" || ingestionRunId.trim().length === 0) {
      return undefined;
    }

    const normalizedIngestionRunId = ingestionRunId.trim();
    if (typeof resolvedIngestionRunId === "undefined") {
      resolvedIngestionRunId = normalizedIngestionRunId;
      continue;
    }

    if (resolvedIngestionRunId !== normalizedIngestionRunId) {
      return undefined;
    }
  }

  return resolvedIngestionRunId;
}

export function readExpectedIngestionRunId(c: Context): string | null {
  const raw = c.req.header(ApiHeaders.parcelIngestionRunId);
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function ingestionRunMismatch(
  expectedIngestionRunId: string | null,
  actualIngestionRunId: string | undefined
): boolean {
  if (expectedIngestionRunId === null) {
    return false;
  }

  if (typeof actualIngestionRunId !== "string" || actualIngestionRunId.trim().length === 0) {
    return true;
  }

  return expectedIngestionRunId !== actualIngestionRunId.trim();
}

export function conflictResponseIfNeeded(
  c: Context,
  requestId: string,
  expectedIngestionRunId: string | null,
  actualIngestionRunId: string | undefined,
  recordCount: number
): Response | null {
  if (recordCount === 0 || !ingestionRunMismatch(expectedIngestionRunId, actualIngestionRunId)) {
    return null;
  }

  return rejectWithConflict(c, requestId, expectedIngestionRunId ?? "", actualIngestionRunId);
}
