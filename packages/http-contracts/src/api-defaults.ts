/**
 * Runtime defaults and data-version resolution.
 *
 * These are operational/config concerns, not wire-contract concerns.
 * Separated from api-routes.ts so that contract-only consumers do not
 * pull in runtime configuration.
 */
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { SourceMode } from "./api-response-meta.js";
import type { ParcelGeometryMode, ParcelProfile } from "./parcels-http.js";

export interface DataVersionResolveOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fallback?: string;
  readonly override?: string | undefined;
}

export interface ApiDefaultsTable {
  readonly analysisSummarySourceMode: SourceMode;
  readonly boundariesSourceMode: SourceMode;
  readonly countyIntelligenceSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly marketBoundariesSourceMode: SourceMode;
  readonly marketsSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}

export interface ApiQueryDefaultsTable {
  readonly facilities: {
    readonly bboxLimit: number;
    readonly perspective: FacilityPerspective;
  };
  readonly parcelDetail: {
    readonly includeGeometry: ParcelGeometryMode;
    readonly profile: ParcelProfile;
  };
}

export const ApiDefaults = Object.freeze<ApiDefaultsTable>({
  analysisSummarySourceMode: "postgis",
  boundariesSourceMode: "postgis",
  countyIntelligenceSourceMode: "postgis",
  dataVersion: "dev",
  facilitiesSourceMode: "postgis",
  fiberLocatorSourceMode: "external-xyz",
  marketBoundariesSourceMode: "postgis",
  marketsSourceMode: "postgis",
  parcelsSourceMode: "postgis",
});

export const ApiQueryDefaults = Object.freeze<ApiQueryDefaultsTable>({
  facilities: {
    bboxLimit: 50_000,
    perspective: "colocation",
  },
  parcelDetail: {
    includeGeometry: "full",
    profile: "analysis_v1",
  },
});

function toNonEmptyValue(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed;
}

export function resolveDataVersion(options: DataVersionResolveOptions = {}): string {
  const override = toNonEmptyValue(options.override);
  if (typeof override === "string") {
    return override;
  }

  const env = options.env ?? {};
  const envCandidates = [env.MAP_DATA_VERSION, env.API_DATA_VERSION, env.DATA_VERSION, env.GIT_SHA];

  const resolvedFromEnv = envCandidates
    .map((envValue) => toNonEmptyValue(envValue))
    .find((resolved): resolved is string => typeof resolved === "string");

  if (typeof resolvedFromEnv === "string") {
    return resolvedFromEnv;
  }

  return toNonEmptyValue(options.fallback) ?? ApiDefaults.dataVersion;
}
