import type { MapExpression } from "@map-migration/map-engine";
import type {
  FacilitiesFeature,
  FacilitiesFilterPredicate,
  FacilityStatusFilterId,
  MapFiltersState,
} from "./map-filters.types";
import { FACILITY_STATUS_TO_SEMANTIC } from "./map-filters.types";

/**
 * Build a predicate that filters facility features based on the current filter state.
 * Returns null if no filters are active (show everything).
 */
/**
 * Map power-type filter IDs to the property checks they represent.
 * "commissioned" → commissionedPowerMw > 0
 * "available" → availablePowerMw > 0
 * "under-construction" → underConstructionPowerMw > 0
 * "planned" → plannedPowerMw > 0
 */
function matchesPowerType(
  feature: FacilitiesFeature,
  powerTypes: ReadonlySet<string>
): boolean {
  for (const pt of powerTypes) {
    if (pt === "commissioned" && (feature.properties.commissionedPowerMw ?? 0) > 0) return true;
    if (pt === "available" && (feature.properties.availablePowerMw ?? 0) > 0) return true;
    if (pt === "under-construction" && (feature.properties.underConstructionPowerMw ?? 0) > 0) return true;
    if (pt === "planned" && (feature.properties.plannedPowerMw ?? 0) > 0) return true;
  }
  return false;
}

export function buildFacilitiesFilterPredicate(
  state: MapFiltersState
): FacilitiesFilterPredicate | null {
  const hasStatusFilter = state.facilityStatuses.size > 0;
  const hasProviderFilter = state.facilityProviders.size > 0;
  const hasPowerTypeFilter = state.powerTypes.size > 0;
  const hasMarketFilter = state.activeMarkets.size > 0;

  if (!(hasStatusFilter || hasProviderFilter || hasPowerTypeFilter || hasMarketFilter)) {
    return null;
  }

  const allowedSemantics = hasStatusFilter
    ? new Set([...state.facilityStatuses].flatMap((id) => FACILITY_STATUS_TO_SEMANTIC[id]))
    : null;

  const allowedProviders = hasProviderFilter ? state.facilityProviders : null;

  return (feature: FacilitiesFeature): boolean => {
    if (
      allowedSemantics !== null &&
      !allowedSemantics.has(feature.properties.commissionedSemantic)
    ) {
      return false;
    }

    if (allowedProviders !== null && !allowedProviders.has(feature.properties.providerName)) {
      return false;
    }

    if (hasPowerTypeFilter && !matchesPowerType(feature, state.powerTypes)) {
      return false;
    }

    if (hasMarketFilter) {
      const city = feature.properties.city;
      const featureState = feature.properties.state;
      const marketLabel = city && featureState ? `${city}, ${featureState}` : null;
      if (marketLabel === null || !state.activeMarkets.has(marketLabel)) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Build a Mapbox GL filter expression for transmission line voltage.
 * Returns null if no filter is active (show everything).
 */
export function buildTransmissionVoltageFilter(state: MapFiltersState): MapExpression | null {
  if (state.transmissionMinVoltage === null) {
    return null;
  }

  return [">=", ["to-number", ["coalesce", ["get", "voltage"], 0]], state.transmissionMinVoltage];
}

/**
 * Resolve which CommissionedSemantic values are allowed by a set of status filter IDs.
 */
export function resolveAllowedSemantics(
  statuses: ReadonlySet<FacilityStatusFilterId>
): Set<string> {
  return new Set([...statuses].flatMap((id) => FACILITY_STATUS_TO_SEMANTIC[id]));
}
