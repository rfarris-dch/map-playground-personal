/**
 * API route constants and builder functions.
 *
 * Runtime defaults (ApiDefaults, ApiQueryDefaults, resolveDataVersion)
 * have been moved to api-defaults.ts. This file only contains route
 * paths, headers, and URL builder functions.
 */

// biome-ignore-all lint/performance/noBarrelFile: public package contract entrypoint is intentional.

import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import { formatBboxParam } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import type { SortDirection } from "./_pagination.js";
import type { BoundaryPowerLevel } from "./boundaries-http.js";
import type { CountyPowerStoryId, CountyPowerStoryWindow } from "./county-power-story-http.js";
import type { MarketBoundaryLevel } from "./market-boundaries-http.js";
import type { ParcelGeometryMode, ParcelProfile } from "./parcels-http.js";

// ---------------------------------------------------------------------------
// Re-exports from api-defaults.ts for backwards compatibility
// ---------------------------------------------------------------------------

export {
  ApiDefaults,
  type ApiDefaultsTable,
  ApiQueryDefaults,
  type ApiQueryDefaultsTable,
  type DataVersionResolveOptions,
  resolveDataVersion,
} from "./api-defaults.js";

// ---------------------------------------------------------------------------
// Route arg interfaces
// ---------------------------------------------------------------------------

export interface PaginatedRouteArgs {
  readonly page: number;
  readonly pageSize: number;
}

export interface SortedPaginatedRouteArgs<TSortBy extends string> extends PaginatedRouteArgs {
  readonly sortBy: TSortBy;
  readonly sortOrder: SortDirection;
}

export interface FacilitiesBboxRouteArgs {
  readonly bbox: BBox;
  readonly datasetVersion?: string | undefined;
  readonly limit?: number | undefined;
  readonly perspective?: FacilityPerspective | undefined;
}

export interface FacilitiesTableRouteArgs extends SortedPaginatedRouteArgs<string> {
  readonly datasetVersion?: string | undefined;
}

export interface FacilityDetailRouteOptions {
  readonly datasetVersion?: string | undefined;
  readonly perspective?: FacilityPerspective | undefined;
}

export interface ParcelDetailRouteOptions {
  readonly includeGeometry?: ParcelGeometryMode | undefined;
  readonly profile?: ParcelProfile | undefined;
}

export interface CountyScoresRouteArgs {
  readonly countyIds: readonly string[];
}

export interface CountyPowerStoryRouteArgs {
  readonly publicationRunId?: string | undefined;
  readonly window?: CountyPowerStoryWindow | undefined;
}

export interface RunReproducibilityRouteArgs {
  readonly runId: string;
  readonly runKind?: "analysis" | "publication" | "replay" | undefined;
  readonly surfaceScope?: "corridor" | "county" | "parcel" | undefined;
}

export interface RunReproducibilityDiffRouteArgs {
  readonly leftRunId: string;
  readonly rightRunId: string;
  readonly runKind?: "analysis" | "publication" | "replay" | undefined;
  readonly surfaceScope?: "corridor" | "county" | "parcel" | undefined;
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

export interface ApiRoutesTable {
  readonly analysisHistory: string;
  readonly analysisSummary: string;
  readonly appPerformanceDebug: string;
  readonly authLogin: string;
  readonly authLogout: string;
  readonly authSession: string;
  readonly boundariesPower: string;
  readonly countyPowerStory: string;
  readonly countyPowerStoryGeometry: string;
  readonly countyPowerStoryTiles: string;
  readonly countyScores: string;
  readonly countyScoresCoverage: string;
  readonly countyScoresDebug: string;
  readonly countyScoresResolution: string;
  readonly countyScoresStatus: string;
  readonly effectMetrics: string;
  readonly facilities: string;
  readonly facilitiesManifest: string;
  readonly facilitiesPerformanceDebug: string;
  readonly facilitiesSelection: string;
  readonly facilitiesTable: string;
  readonly fiberLocatorLayers: string;
  readonly fiberLocatorLayersInView: string;
  readonly fiberLocatorTile: string;
  readonly fiberLocatorVectorTile: string;
  readonly health: string;
  readonly healthAlias: string;
  readonly launchPolicy: string;
  readonly marketBoundaries: string;
  readonly markets: string;
  readonly marketsSelection: string;
  readonly parcels: string;
  readonly providers: string;
  readonly runReproducibility: string;
  readonly runReproducibilityDiff: string;
  readonly usgsWaterTile: string;
}

export interface ApiHeadersTable {
  readonly cacheStatus: string;
  readonly datasetVersion: string;
  readonly dataVersion: string;
  readonly facilitiesInteractionType: string;
  readonly facilitiesMappingTimeMs: string;
  readonly facilitiesRequestedDatasetVersion: string;
  readonly facilitiesResponseBytes: string;
  readonly facilitiesSqlTimeMs: string;
  readonly facilitiesViewMode: string;
  readonly facilitiesViewportKey: string;
  readonly facilitiesZoomBucket: string;
  readonly originRequestId: string;
  readonly parcelIngestionRunId: string;
  readonly requestId: string;
}

export const HealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  now: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthSchema>;

export const ApiRoutes = Object.freeze<ApiRoutesTable>({
  appPerformanceDebug: "/api/debug/app/performance",
  authLogin: "/api/auth/login",
  authLogout: "/api/auth/logout",
  authSession: "/api/auth/session",
  health: "/api/health",
  healthAlias: "/health",
  analysisHistory: "/api/geo/analysis/history",
  analysisSummary: "/api/geo/analysis/summary",
  boundariesPower: "/api/geo/boundaries/power",
  countyPowerStory: "/api/geo/county-power/story",
  countyPowerStoryGeometry: "/api/geo/county-power/story/geometry",
  countyPowerStoryTiles: "/api/geo/county-power/story/tiles",
  countyScoresCoverage: "/api/geo/counties/scores/coverage",
  countyScoresDebug: "/api/geo/counties/scores/debug",
  countyScoresResolution: "/api/geo/counties/scores/resolution",
  countyScores: "/api/geo/counties/scores",
  countyScoresStatus: "/api/geo/counties/scores/status",
  effectMetrics: "/api/debug/effect/issues",
  facilitiesPerformanceDebug: "/api/debug/facilities/performance",
  fiberLocatorLayers: "/api/geo/fiber-locator/layers",
  fiberLocatorLayersInView: "/api/geo/fiber-locator/layers/inview",
  fiberLocatorTile: "/api/geo/fiber-locator/tile",
  fiberLocatorVectorTile: "/api/geo/fiber-locator/vector-tile",
  facilities: "/api/geo/facilities",
  facilitiesManifest: "/api/geo/facilities/manifest",
  facilitiesSelection: "/api/geo/facilities/selection",
  facilitiesTable: "/api/geo/facilities/table",
  launchPolicy: "/api/geo/launch-policy",
  marketBoundaries: "/api/geo/market-boundaries",
  markets: "/api/geo/markets",
  marketsSelection: "/api/geo/markets/selection",
  providers: "/api/geo/providers",
  runReproducibility: "/api/geo/run-reproducibility",
  runReproducibilityDiff: "/api/geo/run-reproducibility/diff",
  parcels: "/api/geo/parcels",
  usgsWaterTile: "/api/tiles/usgs-water",
});

export const ApiHeaders = Object.freeze<ApiHeadersTable>({
  cacheStatus: "x-cache-status",
  dataVersion: "x-data-version",
  datasetVersion: "x-dataset-version",
  facilitiesInteractionType: "x-facilities-interaction-type",
  facilitiesMappingTimeMs: "x-facilities-mapping-time-ms",
  facilitiesRequestedDatasetVersion: "x-facilities-requested-dataset-version",
  facilitiesResponseBytes: "x-facilities-response-bytes",
  facilitiesSqlTimeMs: "x-facilities-sql-time-ms",
  facilitiesViewMode: "x-facilities-view-mode",
  facilitiesViewportKey: "x-facilities-viewport-key",
  facilitiesZoomBucket: "x-facilities-zoom-bucket",
  originRequestId: "x-origin-request-id",
  parcelIngestionRunId: "x-parcel-ingestion-run-id",
  requestId: "x-request-id",
});

// ---------------------------------------------------------------------------
// Defaults — re-exported from api-defaults.ts but also local reference
// for route builders that need default perspective/profile values.
// ---------------------------------------------------------------------------

const DEFAULT_PERSPECTIVE = "colocation" as const;
const DEFAULT_PARCEL_PROFILE = "analysis_v1" as const;
const DEFAULT_PARCEL_GEOMETRY = "full" as const;

// ---------------------------------------------------------------------------
// Route builder helpers
// ---------------------------------------------------------------------------

function appendQueryToRoute(
  baseRoute: string,
  params: ReadonlyArray<readonly [string, string | undefined]>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of params) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  const serializedQuery = query.toString();
  if (serializedQuery.length === 0) {
    return baseRoute;
  }

  return `${baseRoute}?${serializedQuery}`;
}

export function buildFacilityDetailRoute(
  facilityId: string,
  options: FacilityDetailRouteOptions = {}
): string {
  return appendQueryToRoute(`${ApiRoutes.facilities}/${encodeURIComponent(facilityId)}`, [
    ["perspective", options.perspective ?? DEFAULT_PERSPECTIVE],
    ["v", options.datasetVersion],
  ]);
}

export function buildFacilitiesBboxRoute(args: FacilitiesBboxRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.facilities, [
    ["bbox", formatBboxParam(args.bbox)],
    ["perspective", args.perspective ?? DEFAULT_PERSPECTIVE],
    ["limit", typeof args.limit === "number" ? String(args.limit) : undefined],
    ["v", args.datasetVersion],
  ]);
}

export function buildFacilitiesManifestRoute(): string {
  return ApiRoutes.facilitiesManifest;
}

export function buildLaunchPolicyRoute(): string {
  return ApiRoutes.launchPolicy;
}

export function buildRunReproducibilityRoute(args: RunReproducibilityRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.runReproducibility, [
    ["surfaceScope", args.surfaceScope ?? "county"],
    ["runKind", args.runKind ?? "publication"],
    ["runId", args.runId],
  ]);
}

export function buildRunReproducibilityDiffRoute(args: RunReproducibilityDiffRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.runReproducibilityDiff, [
    ["surfaceScope", args.surfaceScope ?? "county"],
    ["runKind", args.runKind ?? "publication"],
    ["leftRunId", args.leftRunId],
    ["rightRunId", args.rightRunId],
  ]);
}

export function buildAppPerformanceDebugRoute(): string {
  return ApiRoutes.appPerformanceDebug;
}

export function buildAuthLoginRoute(): string {
  return ApiRoutes.authLogin;
}

export function buildAuthLogoutRoute(): string {
  return ApiRoutes.authLogout;
}

export function buildAuthSessionRoute(): string {
  return ApiRoutes.authSession;
}

export function buildFacilitiesSelectionRoute(): string {
  return ApiRoutes.facilitiesSelection;
}

export function buildSpatialAnalysisSummaryRoute(): string {
  return ApiRoutes.analysisSummary;
}

export function buildSpatialAnalysisHistoryRoute(): string {
  return ApiRoutes.analysisHistory;
}

export function buildBoundaryPowerRoute(level: BoundaryPowerLevel): string {
  const params = new URLSearchParams();
  params.set("level", level);
  return `${ApiRoutes.boundariesPower}?${params.toString()}`;
}

/**
 * FIX: version parameter is now explicit via the `version` arg instead of
 * being silently hardcoded to "4". Callers must pass the version they want.
 */
export function buildMarketBoundariesRoute(level: MarketBoundaryLevel, version?: string): string {
  const params = new URLSearchParams();
  params.set("level", level);
  if (typeof version === "string") {
    params.set("v", version);
  }
  return `${ApiRoutes.marketBoundaries}?${params.toString()}`;
}

export function buildCountyPowerStoryGeometryRoute(): string {
  return ApiRoutes.countyPowerStoryGeometry;
}

export function buildCountyPowerStoryVectorTileRoute(args: {
  readonly x: number | string;
  readonly y: number | string;
  readonly z: number | string;
}): string {
  return `${ApiRoutes.countyPowerStoryTiles}/${String(args.z)}/${String(args.x)}/${String(args.y)}`;
}

export function buildCountyPowerStoryVectorTileTemplateRoute(): string {
  return `${ApiRoutes.countyPowerStoryTiles}/{z}/{x}/{y}`;
}

export function buildCountyPowerStorySnapshotRoute(
  storyId: CountyPowerStoryId,
  args: CountyPowerStoryRouteArgs = {}
): string {
  return appendQueryToRoute(`${ApiRoutes.countyPowerStory}/${encodeURIComponent(storyId)}`, [
    ["window", args.window],
    ["publicationRunId", args.publicationRunId],
  ]);
}

/**
 * FIX: `window` is now forwarded to the query string (was silently dropped).
 */
export function buildCountyPowerStoryTimelineRoute(
  storyId: CountyPowerStoryId,
  args: CountyPowerStoryRouteArgs = {}
): string {
  return appendQueryToRoute(
    `${ApiRoutes.countyPowerStory}/${encodeURIComponent(storyId)}/timeline`,
    [
      ["window", args.window],
      ["publicationRunId", args.publicationRunId],
    ]
  );
}

export function buildCountyScoresRoute(args: CountyScoresRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.countyScores, [
    ["countyIds", args.countyIds.length > 0 ? args.countyIds.join(",") : undefined],
  ]);
}

export function buildCountyScoresStatusRoute(): string {
  return ApiRoutes.countyScoresStatus;
}

export function buildCountyScoresCoverageRoute(): string {
  return ApiRoutes.countyScoresCoverage;
}

export function buildCountyScoresResolutionRoute(): string {
  return ApiRoutes.countyScoresResolution;
}

export function buildCountyScoresDebugRoute(args: CountyScoresRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.countyScoresDebug, [
    ["countyIds", args.countyIds.length > 0 ? args.countyIds.join(",") : undefined],
  ]);
}

export function buildParcelDetailRoute(
  parcelId: string,
  options: ParcelDetailRouteOptions = {}
): string {
  return appendQueryToRoute(`${ApiRoutes.parcels}/${encodeURIComponent(parcelId)}`, [
    ["profile", options.profile ?? DEFAULT_PARCEL_PROFILE],
    ["includeGeometry", options.includeGeometry ?? DEFAULT_PARCEL_GEOMETRY],
  ]);
}

export function buildParcelLookupRoute(): string {
  return `${ApiRoutes.parcels}/lookup`;
}

export function buildParcelEnrichRoute(): string {
  return `${ApiRoutes.parcels}/enrich`;
}

function buildPaginatedRoute(
  baseRoute: string,
  args: PaginatedRouteArgs,
  sortArgs?: { readonly sortBy: string; readonly sortOrder: SortDirection },
  additionalParams: ReadonlyArray<readonly [string, string | undefined]> = []
): string {
  const params = new URLSearchParams();
  params.set("page", String(args.page));
  params.set("pageSize", String(args.pageSize));
  if (sortArgs) {
    params.set("sortBy", sortArgs.sortBy);
    params.set("sortOrder", sortArgs.sortOrder);
  }
  additionalParams.reduce((nextParams, [key, value]) => {
    if (typeof value === "string") {
      nextParams.set(key, value);
    }
    return nextParams;
  }, params);

  return `${baseRoute}?${params.toString()}`;
}

export function buildMarketsRoute(args: SortedPaginatedRouteArgs<string>): string {
  return buildPaginatedRoute(ApiRoutes.markets, args, {
    sortBy: args.sortBy,
    sortOrder: args.sortOrder,
  });
}

export function buildMarketsSelectionRoute(): string {
  return ApiRoutes.marketsSelection;
}

export function buildProvidersRoute(args: SortedPaginatedRouteArgs<string>): string {
  return buildPaginatedRoute(ApiRoutes.providers, args, {
    sortBy: args.sortBy,
    sortOrder: args.sortOrder,
  });
}

export function buildFacilitiesTableRoute(
  perspective: FacilityPerspective,
  args: FacilitiesTableRouteArgs
): string {
  return buildPaginatedRoute(
    ApiRoutes.facilitiesTable,
    args,
    {
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
    },
    [
      ["perspective", perspective],
      ["v", args.datasetVersion],
    ]
  );
}

export function buildFiberLocatorLayersInViewRoute(bbox: BBox): string {
  const encodedBbox = encodeURIComponent(formatBboxParam(bbox));
  return `${ApiRoutes.fiberLocatorLayersInView}/${encodedBbox}`;
}

export function buildFiberLocatorTileRoute(
  layerName: string,
  z: number | string,
  x: number | string,
  y: number | string
): string {
  return `${ApiRoutes.fiberLocatorTile}/${encodeURIComponent(layerName)}/${String(z)}/${String(x)}/${String(y)}.png`;
}

export function buildFiberLocatorVectorTileRoute(
  layerName: string,
  z: number | string,
  x: number | string,
  y: number | string
): string {
  return `${ApiRoutes.fiberLocatorVectorTile}/${encodeURIComponent(layerName)}/${String(z)}/${String(x)}/${String(y)}.pbf`;
}

export function buildEffectMetricsRoute(): string {
  return ApiRoutes.effectMetrics;
}

export function buildUsgsWaterTileRoute(
  z: number | string,
  x: number | string,
  y: number | string
): string {
  return `${ApiRoutes.usgsWaterTile}/${String(z)}/${String(x)}/${String(y)}`;
}
