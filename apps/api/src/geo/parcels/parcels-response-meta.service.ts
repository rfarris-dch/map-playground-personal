import type { AreaOfInterest } from "@map-migration/geo-kernel/area-of-interest";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  ParcelGeometryMode,
  ParcelProfile,
  ParcelResponseMeta,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import { buildResponseMeta } from "@/http/response-meta.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";

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
  readonly aoiType?: AreaOfInterest["type"];
  readonly nextCursor?: string | null;
  readonly ingestionRunId: string | undefined;
}): ParcelResponseMeta {
  const runtimeConfig = getApiRuntimeConfig();
  const meta: ParcelResponseMeta = {
    ...buildResponseMeta({
      dataVersion: runtimeConfig.dataVersion,
      recordCount: args.recordCount,
      requestId: args.requestId,
      sourceMode: runtimeConfig.parcelsSourceMode,
      truncated: args.truncated,
      warnings: sanitizeWarnings(args.warnings),
    }),
    includeGeometry: args.includeGeometry,
    profile: args.profile,
  };

  if (typeof args.aoiType !== "undefined") {
    meta.aoiType = args.aoiType;
  }

  if (typeof args.nextCursor !== "undefined") {
    meta.nextCursor = args.nextCursor;
  }

  return meta;
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
