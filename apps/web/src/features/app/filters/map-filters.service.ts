import type { MapExpression } from "@map-migration/map-engine";
import type {
  FacilitiesFeature,
  FacilitiesFilterPredicate,
  MapFiltersState,
} from "./map-filters.types";
import { FACILITY_STATUS_TO_SEMANTIC } from "./map-filters.types";

function matchesPowerType(feature: FacilitiesFeature, powerTypes: ReadonlySet<string>): boolean {
  for (const pt of powerTypes) {
    if (pt === "commissioned" && (feature.properties.commissionedPowerMw ?? 0) > 0) {
      return true;
    }
    if (pt === "available" && (feature.properties.availablePowerMw ?? 0) > 0) {
      return true;
    }
    if (pt === "under-construction" && (feature.properties.underConstructionPowerMw ?? 0) > 0) {
      return true;
    }
    if (pt === "planned" && (feature.properties.plannedPowerMw ?? 0) > 0) {
      return true;
    }
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

    return true;
  };
}

export function buildTransmissionVoltageFilter(state: MapFiltersState): MapExpression | null {
  if (state.transmissionMinVoltage === null) {
    return null;
  }

  return [
    "any",
    ["!", ["has", "voltage"]],
    [">=", ["to-number", ["get", "voltage"], 9999], state.transmissionMinVoltage],
  ];
}

export function buildGasPipelineFilter(state: MapFiltersState): MapExpression | null {
  const hasCapacity = state.gasCapacities.size > 0;
  const hasStatus = state.gasStatuses.size > 0;
  if (!(hasCapacity || hasStatus)) {
    return null;
  }

  const conditions: MapExpression[] = [];

  if (hasStatus) {
    const statusValues = [...state.gasStatuses];
    conditions.push([
      "match",
      ["downcase", ["to-string", ["coalesce", ["get", "status"], ""]]],
      statusValues,
      true,
      false,
    ]);
  }

  if (hasCapacity) {
    const capacityValues = [...state.gasCapacities];
    conditions.push([
      "match",
      ["to-string", ["coalesce", ["get", "capacity_range"], ""]],
      capacityValues,
      true,
      false,
    ]);
  }

  if (conditions.length === 0) {
    return null;
  }
  if (conditions.length === 1) {
    const single = conditions[0];
    if (single !== undefined) {
      return single;
    }
  }
  return ["all", ...conditions];
}

export function buildParcelFilter(state: MapFiltersState): MapExpression | null {
  const conditions: MapExpression[] = [];
  const zoningTypeCondition = buildParcelZoningTypeFilter(state.zoningTypes);
  if (zoningTypeCondition !== null) {
    conditions.push(zoningTypeCondition);
  }

  const floodZoneCondition = buildParcelFloodZoneFilter(state.floodZones);
  if (floodZoneCondition !== null) {
    conditions.push(floodZoneCondition);
  }

  conditions.push(...buildParcelAcreFilters(state.parcelStyleAcres));
  conditions.push(...buildParcelAcreRangeFilters(state.parcelAcresMin, state.parcelAcresMax));

  if (conditions.length === 0) {
    return null;
  }

  if (conditions.length === 1) {
    return conditions[0] ?? null;
  }

  return ["all", ...conditions];
}

function buildParcelZoningTypeFilter(zoningTypes: ReadonlySet<string>): MapExpression | null {
  if (zoningTypes.size === 0) {
    return null;
  }

  const allowed = [...zoningTypes].map((zoningType) => zoningType.toLowerCase());
  return ["in", ["downcase", ["coalesce", ["get", "zoning_type"], ""]], ["literal", allowed]];
}

function buildParcelFloodZoneFilter(floodZones: ReadonlySet<string>): MapExpression | null {
  if (floodZones.size === 0) {
    return null;
  }

  const floodConditions = [...floodZones]
    .map(buildFloodZoneCondition)
    .filter((condition): condition is MapExpression => condition !== null);

  if (floodConditions.length === 0) {
    return null;
  }

  return ["any", ...floodConditions];
}

function buildFloodZoneCondition(zone: string): MapExpression | null {
  switch (zone) {
    case "low-risk":
      return [
        "any",
        ["!", ["has", "fema_flood_zone"]],
        ["==", ["get", "fema_flood_zone"], ""],
        ["==", ["get", "fema_flood_zone"], "X"],
        ["==", ["get", "fema_flood_zone"], "C"],
      ];
    case "high-risk":
      return [
        "any",
        ["==", ["get", "fema_flood_zone"], "A"],
        ["==", ["get", "fema_flood_zone"], "AE"],
        ["==", ["get", "fema_flood_zone"], "AH"],
        ["==", ["get", "fema_flood_zone"], "AO"],
        ["==", ["get", "fema_flood_zone"], "A99"],
      ];
    case "coastal-high-risk":
      return [
        "any",
        ["==", ["get", "fema_flood_zone"], "V"],
        ["==", ["get", "fema_flood_zone"], "VE"],
      ];
    default:
      return null;
  }
}

function buildParcelAcreRangeFilters(
  min: number | null | undefined,
  max: number | null | undefined
): readonly MapExpression[] {
  const lo = typeof min === "number" ? min : null;
  const hi = typeof max === "number" ? max : null;
  if (lo === null && hi === null) {
    return [];
  }

  const acreExpr: MapExpression = ["to-number", ["coalesce", ["get", "ll_gisacre"], 0]];
  const conditions: MapExpression[] = [];

  if (lo !== null) {
    conditions.push([">=", acreExpr, lo]);
  }
  if (hi !== null) {
    conditions.push(["<=", acreExpr, hi]);
  }

  return conditions;
}

function buildParcelAcreFilters(parcelStyleAcres: string): readonly MapExpression[] {
  if (parcelStyleAcres === "" || parcelStyleAcres === "all") {
    return [];
  }

  const acreRange = parseAcreRange(parcelStyleAcres);
  if (acreRange === null) {
    return [];
  }

  const acreExpr: MapExpression = ["to-number", ["coalesce", ["get", "ll_gisacre"], 0]];
  const conditions: MapExpression[] = [];

  if (acreRange.min !== null) {
    conditions.push([">=", acreExpr, acreRange.min]);
  }

  if (acreRange.max !== null) {
    conditions.push(["<=", acreExpr, acreRange.max]);
  }

  return conditions;
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
