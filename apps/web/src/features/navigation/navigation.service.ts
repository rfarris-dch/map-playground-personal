import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import type { RouteLocationRaw } from "vue-router";
import { buildMapContextTransferQuery } from "@/features/map-context-transfer/map-context-transfer.service";
import type {
  AppNavigationItem,
  CompanyDashboardRouteParams,
  CompanyMapRouteParams,
  FacilityDetailRouteParams,
  FacilityNavigationItem,
  MarketDashboardRouteParams,
  MarketMapRouteParams,
  ProviderDetailRouteParams,
} from "@/features/navigation/navigation.types";

export const appNavigationItems: readonly AppNavigationItem[] = [
  {
    label: "Map",
    navigationId: "map",
    routeName: "map",
    to: "/map",
  },
  {
    label: "Markets",
    navigationId: "markets",
    routeName: "markets",
    to: "/markets",
  },
  {
    label: "Providers",
    navigationId: "providers",
    routeName: "providers",
    to: "/providers",
  },
  {
    label: "Facilities",
    navigationId: "facilities",
    routeName: "facilities",
    to: "/facilities",
  },
];

export const facilityNavigationItems: readonly FacilityNavigationItem[] = [
  {
    description: "Largest footprints, cloud-first tenancy, and utility-scale power planning.",
    label: "Hyperscale",
    routeName: "facilities-hyperscale",
    to: "/facilities/hyperscale",
  },
  {
    description: "Carrier-dense, retail-oriented colocation footprints and interconnection hubs.",
    label: "Colocation",
    routeName: "facilities-colocation",
    to: "/facilities/colocation",
  },
];

function buildRouteLocationWithMapContext(
  path: string,
  context?: MapContextTransfer
): RouteLocationRaw {
  if (typeof context === "undefined") {
    return { path };
  }

  return {
    path,
    query: buildMapContextTransferQuery(context),
  };
}

export function buildGlobalMapRoute(context?: MapContextTransfer): RouteLocationRaw {
  return buildRouteLocationWithMapContext("/map", context);
}

export function buildMarketMapRoute(
  params: MarketMapRouteParams,
  context?: MapContextTransfer
): RouteLocationRaw {
  return buildRouteLocationWithMapContext(
    `/markets/${encodeURIComponent(params.marketSlug)}/map`,
    context
  );
}

export function buildCompanyMapRoute(
  params: CompanyMapRouteParams,
  context?: MapContextTransfer
): RouteLocationRaw {
  return buildRouteLocationWithMapContext(
    `/companies/${encodeURIComponent(params.companyKind)}/${encodeURIComponent(params.companySlug)}/map`,
    context
  );
}

export function buildMarketDashboardRoute(
  params: MarketDashboardRouteParams,
  context?: MapContextTransfer
): RouteLocationRaw {
  return buildRouteLocationWithMapContext(
    `/markets/${encodeURIComponent(params.marketSlug)}/dashboard`,
    context
  );
}

export function buildCompanyDashboardRoute(
  params: CompanyDashboardRouteParams,
  context?: MapContextTransfer
): RouteLocationRaw {
  return buildRouteLocationWithMapContext(
    `/companies/${encodeURIComponent(params.companyKind)}/${encodeURIComponent(params.companySlug)}/dashboard`,
    context
  );
}

export function buildFacilityDetailPageRoute(params: FacilityDetailRouteParams): RouteLocationRaw {
  return {
    name: "facility-detail",
    params: {
      facilityId: params.facilityId,
      perspective: params.perspective,
    },
  };
}

export function buildProviderDetailPageRoute(params: ProviderDetailRouteParams): RouteLocationRaw {
  return {
    name: "provider-detail",
    params: {
      providerId: params.providerId,
    },
  };
}
