import type { FacilitiesFeatureCollection } from "@map-migration/contracts";
import type { MapExpression } from "@map-migration/map-engine";
import { computed, type Ref, shallowRef, watch } from "vue";
import {
  buildFacilitiesFilterPredicate,
  buildTransmissionVoltageFilter,
} from "./map-filters.service";
import type {
  FacilitiesFilterPredicate,
  FacilityStatusFilterId,
  MapFiltersState,
  TransmissionVoltageFilterId,
} from "./map-filters.types";
import { VOLTAGE_THRESHOLDS } from "./map-filters.types";

type ToggleSetField = Extract<
  keyof MapFiltersState,
  "activeMarkets" | "activeUsers" | "powerTypes" | "gasCapacities" | "gasStatuses" | "zoningTypes" | "floodZones"
>;

type FacilitiesFeatures = FacilitiesFeatureCollection["features"];

export interface UseMapFiltersResult {
  /** Sorted unique market names seen across all viewport updates. */
  readonly availableMarkets: Ref<readonly string[]>;

  /** Sorted unique provider names seen across all viewport updates. */
  readonly availableProviders: Ref<readonly string[]>;
  clearAll(): void;

  readonly facilitiesPredicate: Readonly<
    ReturnType<typeof shallowRef<FacilitiesFilterPredicate | null>>
  >;

  /** Feed raw (unfiltered) cached features to update available filter options. */
  setAvailableFeatures(features: FacilitiesFeatures): void;
  setTransmissionVoltage(id: TransmissionVoltageFilterId | null): void;
  readonly state: Readonly<ReturnType<typeof shallowRef<MapFiltersState>>>;
  toggleFacilityProvider(providerName: string): void;

  toggleFacilityStatus(id: FacilityStatusFilterId): void;
  readonly transmissionFilter: Readonly<ReturnType<typeof shallowRef<MapExpression | null>>>;

  togglePowerType(id: string): void;
  toggleMarket(id: string): void;
  toggleUser(id: string): void;
  setInterconnectivityHub(enabled: boolean): void;
  toggleGasCapacity(id: string): void;
  toggleGasStatus(id: string): void;
  setParcelDataset(value: string): void;
  setParcelStyleAcres(value: string): void;
  setParcelDavPercent(value: string): void;
  toggleZoningType(id: string): void;
  toggleFloodZone(id: string): void;
}

function createInitialState(): MapFiltersState {
  return {
    facilityStatuses: new Set(),
    facilityProviders: new Set(),
    transmissionMinVoltage: null,
    activeMarkets: new Set(),
    activeUsers: new Set(),
    interconnectivityHub: false,
    powerTypes: new Set(),
    gasCapacities: new Set(),
    gasStatuses: new Set(),
    parcelDataset: "",
    parcelStyleAcres: "",
    parcelDavPercent: "",
    zoningTypes: new Set(),
    floodZones: new Set(),
  };
}

export function useMapFilters(): UseMapFiltersResult {
  const state = shallowRef<MapFiltersState>(createInitialState());
  const facilitiesPredicate = shallowRef<FacilitiesFilterPredicate | null>(null);
  const transmissionFilter = shallowRef<MapExpression | null>(null);

  // Accumulate unique values from features — never shrink, only grow
  const knownProviders = shallowRef<ReadonlySet<string>>(new Set());
  const knownMarkets = shallowRef<ReadonlySet<string>>(new Set());

  watch(
    state,
    (current) => {
      facilitiesPredicate.value = buildFacilitiesFilterPredicate(current);
      transmissionFilter.value = buildTransmissionVoltageFilter(current);
    },
    { immediate: true }
  );

  const availableProviders = computed(() =>
    [...knownProviders.value].sort((a, b) => a.localeCompare(b))
  );

  const availableMarkets = computed(() =>
    [...knownMarkets.value].sort((a, b) => a.localeCompare(b))
  );

  function updateState(updater: (prev: MapFiltersState) => MapFiltersState): void {
    state.value = updater(state.value);
  }

  function toggleFacilityStatus(id: FacilityStatusFilterId): void {
    updateState((prev) => {
      const next = new Set(prev.facilityStatuses);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, facilityStatuses: next };
    });
  }

  function toggleFacilityProvider(providerName: string): void {
    updateState((prev) => {
      const next = new Set(prev.facilityProviders);
      if (next.has(providerName)) {
        next.delete(providerName);
      } else {
        next.add(providerName);
      }
      return { ...prev, facilityProviders: next };
    });
  }

  function setTransmissionVoltage(id: TransmissionVoltageFilterId | null): void {
    updateState((prev) => ({
      ...prev,
      transmissionMinVoltage: id !== null ? VOLTAGE_THRESHOLDS[id] : null,
    }));
  }

  function toggleSetField(field: ToggleSetField, id: string): void {
    updateState((prev) => {
      const next = new Set(prev[field]);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, [field]: next };
    });
  }

  function togglePowerType(id: string): void {
    toggleSetField("powerTypes", id);
  }

  function toggleMarket(id: string): void {
    toggleSetField("activeMarkets", id);
  }

  function toggleUser(id: string): void {
    toggleSetField("activeUsers", id);
  }

  function setInterconnectivityHub(enabled: boolean): void {
    updateState((prev) => ({ ...prev, interconnectivityHub: enabled }));
  }

  function toggleGasCapacity(id: string): void {
    toggleSetField("gasCapacities", id);
  }

  function toggleGasStatus(id: string): void {
    toggleSetField("gasStatuses", id);
  }

  function setParcelDataset(value: string): void {
    updateState((prev) => ({ ...prev, parcelDataset: value }));
  }

  function setParcelStyleAcres(value: string): void {
    updateState((prev) => ({ ...prev, parcelStyleAcres: value }));
  }

  function setParcelDavPercent(value: string): void {
    updateState((prev) => ({ ...prev, parcelDavPercent: value }));
  }

  function toggleZoningType(id: string): void {
    toggleSetField("zoningTypes", id);
  }

  function toggleFloodZone(id: string): void {
    toggleSetField("floodZones", id);
  }

  function clearAll(): void {
    state.value = createInitialState();
    knownProviders.value = new Set();
    knownMarkets.value = new Set();
  }

  function setAvailableFeatures(features: FacilitiesFeatures): void {
    let providersChanged = false;
    let marketsChanged = false;
    const nextProviders = new Set(knownProviders.value);
    const nextMarkets = new Set(knownMarkets.value);

    for (const feature of features) {
      const { providerName, city, state: featureState } = feature.properties;

      if (providerName && !nextProviders.has(providerName)) {
        nextProviders.add(providerName);
        providersChanged = true;
      }

      // Derive market label from city + state (best available proxy)
      if (city && featureState) {
        const marketLabel = `${city}, ${featureState}`;
        if (!nextMarkets.has(marketLabel)) {
          nextMarkets.add(marketLabel);
          marketsChanged = true;
        }
      }
    }

    if (providersChanged) {
      knownProviders.value = nextProviders;
    }
    if (marketsChanged) {
      knownMarkets.value = nextMarkets;
    }
  }

  return {
    state,
    toggleFacilityStatus,
    toggleFacilityProvider,
    setTransmissionVoltage,
    clearAll,
    facilitiesPredicate,
    transmissionFilter,
    availableProviders,
    availableMarkets,
    setAvailableFeatures,
    togglePowerType,
    toggleMarket,
    toggleUser,
    setInterconnectivityHub,
    toggleGasCapacity,
    toggleGasStatus,
    setParcelDataset,
    setParcelStyleAcres,
    setParcelDavPercent,
    toggleZoningType,
    toggleFloodZone,
  };
}
