import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import { formatBboxParam } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import type { SourceMode } from "./api-response-meta.js";
import type { BoundaryPowerLevel } from "./boundaries-http.js";
import type { MarketBoundaryLevel } from "./market-boundaries-http.js";
import type { ParcelGeometryMode, ParcelProfile } from "./parcels-http.js";
import { isPipelineDataset, type PipelineDataset } from "./pipeline-http.js";
import type {
  FacilitySortBy,
  MarketSortBy,
  ProviderSortBy,
  SortDirection,
} from "./table-contracts.js";

export interface DataVersionResolveOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fallback?: string;
  readonly override?: string | undefined;
}

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

export interface FacilitiesTableRouteArgs extends SortedPaginatedRouteArgs<FacilitySortBy> {
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

export interface ApiRoutesTable {
  readonly analysisHistory: string;
  readonly analysisSummary: string;
  readonly boundariesPower: string;
  readonly countyScores: string;
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
  readonly marketBoundaries: string;
  readonly markets: string;
  readonly marketsSelection: string;
  readonly parcels: string;
  readonly pipelines: string;
  readonly providers: string;
  readonly usgsWaterTile: string;
}

export interface ApiHeadersTable {
  readonly cacheStatus: string;
  readonly datasetVersion: string;
  readonly dataVersion: string;
  readonly facilitiesInteractionType: string;
  readonly facilitiesViewMode: string;
  readonly facilitiesViewportKey: string;
  readonly facilitiesZoomBucket: string;
  readonly originRequestId: string;
  readonly parcelIngestionRunId: string;
  readonly requestId: string;
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

export const HealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  now: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthSchema>;

export const ApiRoutes = Object.freeze<ApiRoutesTable>({
  health: "/api/health",
  healthAlias: "/health",
  analysisHistory: "/api/geo/analysis/history",
  analysisSummary: "/api/geo/analysis/summary",
  boundariesPower: "/api/geo/boundaries/power",
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
  marketBoundaries: "/api/geo/market-boundaries",
  markets: "/api/geo/markets",
  marketsSelection: "/api/geo/markets/selection",
  providers: "/api/geo/providers",
  parcels: "/api/geo/parcels",
  pipelines: "/api/pipelines",
  usgsWaterTile: "/api/tiles/usgs-water",
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
    ["perspective", options.perspective ?? ApiQueryDefaults.facilities.perspective],
    ["v", options.datasetVersion],
  ]);
}

export function buildFacilitiesBboxRoute(args: FacilitiesBboxRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.facilities, [
    ["bbox", formatBboxParam(args.bbox)],
    ["perspective", args.perspective ?? ApiQueryDefaults.facilities.perspective],
    ["limit", typeof args.limit === "number" ? String(args.limit) : undefined],
    ["v", args.datasetVersion],
  ]);
}

export function buildFacilitiesManifestRoute(): string {
  return ApiRoutes.facilitiesManifest;
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

export function buildMarketBoundariesRoute(level: MarketBoundaryLevel): string {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("v", "4");
  return `${ApiRoutes.marketBoundaries}?${params.toString()}`;
}

export function buildCountyScoresRoute(args: CountyScoresRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.countyScores, [
    ["countyIds", args.countyIds.length > 0 ? args.countyIds.join(",") : undefined],
  ]);
}

export function buildCountyScoresStatusRoute(): string {
  return ApiRoutes.countyScoresStatus;
}

export function buildParcelDetailRoute(
  parcelId: string,
  options: ParcelDetailRouteOptions = {}
): string {
  return appendQueryToRoute(`${ApiRoutes.parcels}/${encodeURIComponent(parcelId)}`, [
    ["profile", options.profile ?? ApiQueryDefaults.parcelDetail.profile],
    ["includeGeometry", options.includeGeometry ?? ApiQueryDefaults.parcelDetail.includeGeometry],
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

export function buildMarketsRoute(args: SortedPaginatedRouteArgs<MarketSortBy>): string {
  return buildPaginatedRoute(ApiRoutes.markets, args, {
    sortBy: args.sortBy,
    sortOrder: args.sortOrder,
  });
}

export function buildMarketsSelectionRoute(): string {
  return ApiRoutes.marketsSelection;
}

export function buildProvidersRoute(args: SortedPaginatedRouteArgs<ProviderSortBy>): string {
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

export function buildPipelineStatusRoute(dataset: PipelineDataset): string {
  if (!isPipelineDataset(dataset)) {
    throw new Error(`Unsupported pipeline dataset "${dataset}"`);
  }

  return `${ApiRoutes.pipelines}/${dataset}/status`;
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

export const ApiHeaders = Object.freeze<ApiHeadersTable>({
  cacheStatus: "x-cache-status",
  dataVersion: "x-data-version",
  datasetVersion: "x-dataset-version",
  facilitiesInteractionType: "x-facilities-interaction-type",
  facilitiesViewMode: "x-facilities-view-mode",
  facilitiesViewportKey: "x-facilities-viewport-key",
  facilitiesZoomBucket: "x-facilities-zoom-bucket",
  originRequestId: "x-origin-request-id",
  parcelIngestionRunId: "x-parcel-ingestion-run-id",
  requestId: "x-request-id",
});

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
