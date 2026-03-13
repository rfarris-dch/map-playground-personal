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
}

function createInitialState(): MapFiltersState {
  return {
    facilityStatuses: new Set(),
    facilityProviders: new Set(),
    transmissionMinVoltage: null,
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
  };
}
