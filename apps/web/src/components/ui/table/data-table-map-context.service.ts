import type { MapContextTransfer } from "@map-migration/http-contracts/map-context-transfer";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import { FACILITY_STATUS_TO_SEMANTIC } from "@/features/app/filters/map-filters.types";
import { readMapContextTransferFromRoute } from "@/features/map-context-transfer/map-context-transfer.service";
import type { PersistedDataTableState } from "./data-table.types";

const stateAbbrevPattern = /^[A-Z]{2}$/;

function singleValue(values: readonly string[] | undefined): string | undefined {
  return Array.isArray(values) && values.length === 1 ? values[0] : undefined;
}

function uniqueSorted(values: readonly string[] | undefined): readonly string[] | undefined {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeQuery(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStateFacetValues(context: MapContextTransfer): readonly string[] | undefined {
  const stateIds = context.selectedBoundaryIds?.state;
  if (!Array.isArray(stateIds) || stateIds.length === 0) {
    return undefined;
  }

  const nextValues = [...new Set(stateIds.map((value) => value.trim().toUpperCase()))].filter(
    (value) => stateAbbrevPattern.test(value)
  );

  return nextValues.length === stateIds.length
    ? nextValues.sort((left, right) => left.localeCompare(right))
    : undefined;
}

function buildFacilitiesSeed(context: MapContextTransfer): PersistedDataTableState | null {
  const facets: Record<string, readonly string[]> = {};

  const providerIds = uniqueSorted(context.providerIds);
  if (typeof providerIds !== "undefined") {
    facets.providerId = providerIds;
  }

  const stateAbbrevs = readStateFacetValues(context);
  if (typeof stateAbbrevs !== "undefined") {
    facets.stateAbbrev = stateAbbrevs;
  }

  const facilityStatuses = context.mapFilters?.facilityStatuses;
  if (Array.isArray(facilityStatuses) && facilityStatuses.length > 0) {
    facets.commissionedSemantic = [
      ...new Set(facilityStatuses.flatMap((status) => FACILITY_STATUS_TO_SEMANTIC[status])),
    ].sort((left, right) => left.localeCompare(right));
  }

  const query = normalizeQuery(
    singleValue(context.facilityIds) ??
      (context.highlightTarget?.kind === "facility" ? context.highlightTarget.id : undefined) ??
      singleValue(context.mapFilters?.facilityProviders)
  );

  if (typeof query === "undefined" && Object.keys(facets).length === 0) {
    return null;
  }

  return {
    ...(typeof query === "undefined" ? {} : { q: query }),
    ...(Object.keys(facets).length === 0 ? {} : { f: facets }),
  };
}

function buildProvidersSeed(context: MapContextTransfer): PersistedDataTableState | null {
  const facets: Record<string, readonly string[]> = {};
  const stateAbbrevs = readStateFacetValues(context);
  if (typeof stateAbbrevs !== "undefined") {
    facets.state = stateAbbrevs;
  }

  const query = normalizeQuery(
    singleValue(context.mapFilters?.facilityProviders) ??
      singleValue(context.providerIds) ??
      (context.highlightTarget?.kind === "provider" ? context.highlightTarget.id : undefined)
  );

  if (typeof query === "undefined" && Object.keys(facets).length === 0) {
    return null;
  }

  return {
    ...(typeof query === "undefined" ? {} : { q: query }),
    ...(Object.keys(facets).length === 0 ? {} : { f: facets }),
  };
}

function buildMarketsSeed(context: MapContextTransfer): PersistedDataTableState | null {
  const facets: Record<string, readonly string[]> = {};
  const stateAbbrevs = readStateFacetValues(context);
  if (typeof stateAbbrevs !== "undefined") {
    facets.state = stateAbbrevs;
  }

  const activeMarketLabel = singleValue(context.mapFilters?.activeMarkets);
  const activeMarketQuery =
    typeof activeMarketLabel === "string"
      ? activeMarketLabel.split(",")[0]?.trim() || activeMarketLabel
      : undefined;

  const query = normalizeQuery(
    activeMarketQuery ??
      singleValue(context.marketIds) ??
      (context.highlightTarget?.kind === "market" ? context.highlightTarget.id : undefined)
  );

  if (typeof query === "undefined" && Object.keys(facets).length === 0) {
    return null;
  }

  return {
    ...(typeof query === "undefined" ? {} : { q: query }),
    ...(Object.keys(facets).length === 0 ? {} : { f: facets }),
  };
}

export function deriveTableSeedStateFromRoute(
  tableId: string,
  route: RouteLocationNormalizedLoaded
): PersistedDataTableState | null {
  const context = readMapContextTransferFromRoute({ route });
  if (context === null) {
    return null;
  }

  switch (tableId) {
    case "facilities-colocation":
    case "facilities-hyperscale":
      return buildFacilitiesSeed(context);
    case "providers":
      return buildProvidersSeed(context);
    case "markets":
      return buildMarketsSeed(context);
    default:
      return null;
  }
}
