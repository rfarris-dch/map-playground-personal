import { z } from "zod";
import type {
  ApiDefaultsTable,
  ApiHeadersTable,
  ApiQueryDefaultsTable,
  ApiRoutesTable,
  DataVersionResolveOptions,
  FacilitiesBboxRouteArgs,
  FacilityDetailRouteOptions,
  PaginatedRouteArgs,
  ParcelDetailRouteOptions,
  SortedPaginatedRouteArgs,
} from "./api-contracts.types";
import type { BoundaryPowerLevel } from "./boundaries-contracts";
import { type BBox, type FacilityPerspective, formatBboxParam } from "./shared-contracts";
import type {
  FacilitySortBy,
  MarketSortBy,
  ProviderSortBy,
  SortDirection,
} from "./table-contracts";

export type {
  ApiDefaultsTable,
  ApiHeadersTable,
  ApiQueryDefaultsTable,
  ApiRoutesTable,
  DataVersionResolveOptions,
  FacilitiesBboxRouteArgs,
  FacilityDetailRouteOptions,
  HealthResponse,
  PaginatedRouteArgs,
  ParcelDetailRouteOptions,
  SortedPaginatedRouteArgs,
} from "./api-contracts.types";

export const HealthSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  now: z.string().datetime(),
});

export const ApiRoutes = Object.freeze<ApiRoutesTable>({
  health: "/api/health",
  boundariesPower: "/api/geo/boundaries/power",
  fiberLocatorLayers: "/api/geo/fiber-locator/layers",
  fiberLocatorLayersInView: "/api/geo/fiber-locator/layers/inview",
  fiberLocatorTile: "/api/geo/fiber-locator/tile",
  fiberLocatorVectorTile: "/api/geo/fiber-locator/vector-tile",
  facilities: "/api/geo/facilities",
  facilitiesSelection: "/api/geo/facilities/selection",
  facilitiesTable: "/api/geo/facilities/table",
  markets: "/api/geo/markets",
  marketsSelection: "/api/geo/markets/selection",
  providers: "/api/geo/providers",
  parcels: "/api/geo/parcels",
  parcelsSyncStatus: "/api/geo/parcels/sync/status",
});

export const ApiQueryDefaults = Object.freeze<ApiQueryDefaultsTable>({
  facilities: {
    bboxLimit: 2000,
    perspective: "colocation",
  },
  parcelDetail: {
    includeGeometry: "full",
    profile: "full_170",
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
  ]);
}

export function buildFacilitiesBboxRoute(args: FacilitiesBboxRouteArgs): string {
  return appendQueryToRoute(ApiRoutes.facilities, [
    ["bbox", formatBboxParam(args.bbox)],
    ["perspective", args.perspective ?? ApiQueryDefaults.facilities.perspective],
    ["limit", typeof args.limit === "number" ? String(args.limit) : undefined],
  ]);
}

export function buildFacilitiesSelectionRoute(): string {
  return ApiRoutes.facilitiesSelection;
}

export function buildBoundaryPowerRoute(level: BoundaryPowerLevel): string {
  const params = new URLSearchParams();
  params.set("level", level);
  return `${ApiRoutes.boundariesPower}?${params.toString()}`;
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
  additionalParams: ReadonlyArray<readonly [string, string]> = []
): string {
  const params = new URLSearchParams();
  params.set("page", String(args.page));
  params.set("pageSize", String(args.pageSize));
  if (sortArgs) {
    params.set("sortBy", sortArgs.sortBy);
    params.set("sortOrder", sortArgs.sortOrder);
  }
  additionalParams.reduce((nextParams, [key, value]) => {
    nextParams.set(key, value);
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
  args: SortedPaginatedRouteArgs<FacilitySortBy>
): string {
  return buildPaginatedRoute(
    ApiRoutes.facilitiesTable,
    args,
    {
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
    },
    [["perspective", perspective]]
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

export function buildParcelsSyncStatusRoute(): string {
  return ApiRoutes.parcelsSyncStatus;
}

export const ApiHeaders = Object.freeze<ApiHeadersTable>({
  parcelIngestionRunId: "x-parcel-ingestion-run-id",
  requestId: "x-request-id",
});

export const ApiDefaults = Object.freeze<ApiDefaultsTable>({
  boundariesSourceMode: "postgis",
  dataVersion: "dev",
  facilitiesSourceMode: "postgis",
  fiberLocatorSourceMode: "external-xyz",
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
