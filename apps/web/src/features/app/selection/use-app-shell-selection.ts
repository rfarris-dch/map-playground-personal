import { shallowRef } from "vue";
import type { UseAppShellSelectionOptions } from "@/features/app/selection/use-app-shell-selection.types";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { useFacilityDetailQuery } from "@/features/facilities/facility-detail/detail";
import { useParcelDetailQuery } from "@/features/parcels/parcel-detail/detail";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";

export function useAppShellSelection(options: UseAppShellSelectionOptions) {
  const selectedFacility = shallowRef<SelectedFacilityRef | null>(null);
  const selectedParcel = shallowRef<SelectedParcelRef | null>(null);

  const facilityDetailQuery = useFacilityDetailQuery(selectedFacility);
  const parcelDetailQuery = useParcelDetailQuery(selectedParcel);

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
    selectedFacility.value = facility;
  }

  function setSelectedFacility(facility: SelectedFacilityRef | null): void {
    selectedFacility.value = facility;
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
    selectedParcel,
    facilityDetailQuery,
    parcelDetailQuery,
    clearSelectedFacility,
    selectFacilityFromAnalysis,
    setSelectedFacility,
    clearSelectedParcel,
    setSelectedParcel,
  };
}
