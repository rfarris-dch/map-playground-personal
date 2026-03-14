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

  if (!(hasStatusFilter || hasProviderFilter || hasPowerTypeFilter)) {
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

    // Note: Market filtering requires spatial join (facility → market boundary)
    // which is done at the API/query level, not as a client-side predicate.

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
 * Build a Mapbox GL filter expression for parcel layers based on zoning type, flood zone, and acreage.
 * Returns null if no filters are active (show everything).
 */
export function buildParcelFilter(state: MapFiltersState): MapExpression | null {
  const conditions: MapExpression[] = [];

  if (state.zoningTypes.size > 0) {
    const allowed = [...state.zoningTypes];
    conditions.push(["in", ["coalesce", ["get", "zoning_type"], ""], ["literal", allowed]]);
  }

  if (state.floodZones.size > 0) {
    const floodConditions: MapExpression[] = [];
    for (const zone of state.floodZones) {
      if (zone === "low-risk") {
        floodConditions.push([
          "any",
          ["!", ["has", "fema_flood_zone"]],
          ["==", ["get", "fema_flood_zone"], ""],
          ["==", ["get", "fema_flood_zone"], "X"],
          ["==", ["get", "fema_flood_zone"], "C"],
        ]);
      } else if (zone === "high-risk") {
        floodConditions.push([
          "any",
          ["==", ["get", "fema_flood_zone"], "A"],
          ["==", ["get", "fema_flood_zone"], "AE"],
          ["==", ["get", "fema_flood_zone"], "AH"],
          ["==", ["get", "fema_flood_zone"], "AO"],
          ["==", ["get", "fema_flood_zone"], "A99"],
        ]);
      } else if (zone === "coastal-high-risk") {
        floodConditions.push([
          "any",
          ["==", ["get", "fema_flood_zone"], "V"],
          ["==", ["get", "fema_flood_zone"], "VE"],
        ]);
      }
    }
    if (floodConditions.length > 0) {
      conditions.push(["any", ...floodConditions]);
    }
  }

  if (state.parcelStyleAcres !== "" && state.parcelStyleAcres !== "all") {
    const acreRange = parseAcreRange(state.parcelStyleAcres);
    if (acreRange !== null) {
      const acreExpr: MapExpression = ["to-number", ["coalesce", ["get", "ll_gisacre"], 0]];
      if (acreRange.min !== null) {
        conditions.push([">=", acreExpr, acreRange.min]);
      }
      if (acreRange.max !== null) {
        conditions.push(["<=", acreExpr, acreRange.max]);
      }
    }
  }

  if (conditions.length === 0) {
    return null;
  }

  if (conditions.length === 1) {
    return conditions[0] ?? null;
  }

  return ["all", ...conditions];
}

function parseAcreRange(value: string): { min: number | null; max: number | null } | null {
  const ranges: Record<string, { min: number | null; max: number | null }> = {
    "0-1": { min: 0, max: 1 },
    "1-5": { min: 1, max: 5 },
    "5-20": { min: 5, max: 20 },
    "20-100": { min: 20, max: 100 },
    "100+": { min: 100, max: null },
  };
  return ranges[value] ?? null;
}

/**
 * Resolve which CommissionedSemantic values are allowed by a set of status filter IDs.
 */
export function resolveAllowedSemantics(
  statuses: ReadonlySet<FacilityStatusFilterId>
): Set<string> {
  return new Set([...statuses].flatMap((id) => FACILITY_STATUS_TO_SEMANTIC[id]));
}
