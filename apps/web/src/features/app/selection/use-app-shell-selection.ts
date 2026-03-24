import { computed, shallowRef } from "vue";
import type { UseAppShellSelectionOptions } from "@/features/app/selection/use-app-shell-selection.types";
import { useCountyScores } from "@/features/county-intelligence/use-county-intelligence";
import type { CountyPowerStorySelectionState } from "@/features/county-power-story/county-power-story.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { useFacilityDetailQuery } from "@/features/facilities/facility-detail/detail";
import { useParcelDetailQuery } from "@/features/parcels/parcel-detail/detail";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";

export function useAppShellSelection(options: UseAppShellSelectionOptions) {
  const selectedFacility = shallowRef<SelectedFacilityRef | null>(null);
  const selectedFacilitySelectionNonce = shallowRef(0);
  const selectedCountyPowerStory = shallowRef<CountyPowerStorySelectionState | null>(null);
  const selectedParcel = shallowRef<SelectedParcelRef | null>(null);

  const facilityDetailQuery = useFacilityDetailQuery(
    selectedFacility,
    selectedFacilitySelectionNonce
  );
  const parcelDetailQuery = useParcelDetailQuery(selectedParcel);
  const countyPowerStoryCountyIds = computed<readonly string[]>(() => {
    const selectedCounty = selectedCountyPowerStory.value;
    return selectedCounty === null ? [] : [selectedCounty.countyFips];
  });
  const countyPowerStoryEnabled = computed(() => selectedCountyPowerStory.value !== null);
  const {
    countyScores: countyPowerStoryScores,
    countyScoresError: countyPowerStoryDetailError,
    countyScoresLoading: countyPowerStoryDetailLoading,
  } = useCountyScores({
    countyIds: countyPowerStoryCountyIds,
    enabled: countyPowerStoryEnabled,
  });
  const countyPowerStoryDetailRow = computed(() => countyPowerStoryScores.value?.rows[0] ?? null);

  function clearSelectedFacility(): void {
    options.facilitiesControllers.value.reduce((_, controller) => {
      controller.clearSelection();
      return 0;
    }, 0);
    selectedFacility.value = null;
  }

  function selectFacilityFromAnalysis(facility: SelectedFacilityRef): void {
    options.facilitiesControllers.value.reduce((_, controller) => {
      controller.clearSelection();
      return 0;
    }, 0);
    selectedFacilitySelectionNonce.value += 1;
    selectedFacility.value = facility;
  }

  function setSelectedFacility(facility: SelectedFacilityRef | null): void {
    if (facility !== null) {
      selectedFacilitySelectionNonce.value += 1;
    }
    selectedFacility.value = facility;
  }

  function clearSelectedCountyPowerStory(): void {
    selectedCountyPowerStory.value = null;
  }

  function setSelectedCountyPowerStory(selection: CountyPowerStorySelectionState | null): void {
    selectedCountyPowerStory.value = selection;
  }

  function clearSelectedParcel(): void {
    options.parcelsController.value?.clearSelection();
    selectedParcel.value = null;
  }

  function setSelectedParcel(parcel: SelectedParcelRef | null): void {
    selectedParcel.value = parcel;
  }

  return {
    selectedFacility,
    selectedCountyPowerStory,
    selectedParcel,
    countyPowerStoryDetailError,
    countyPowerStoryDetailLoading,
    countyPowerStoryDetailRow,
    facilityDetailQuery,
    parcelDetailQuery,
    clearSelectedFacility,
    clearSelectedCountyPowerStory,
    selectFacilityFromAnalysis,
    setSelectedFacility,
    setSelectedCountyPowerStory,
    clearSelectedParcel,
    setSelectedParcel,
  };
}
