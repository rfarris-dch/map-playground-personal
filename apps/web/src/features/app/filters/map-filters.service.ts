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
export function buildFacilitiesFilterPredicate(
  state: MapFiltersState
): FacilitiesFilterPredicate | null {
  const hasStatusFilter = state.facilityStatuses.size > 0;
  const hasProviderFilter = state.facilityProviders.size > 0;

  if (!(hasStatusFilter || hasProviderFilter)) {
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
