import { PARCELS_LAYER_ID } from "@/features/app/core/app-shell.constants";
import { resolveDisableParcelsGuardrails } from "@/features/app/lifecycle/app-shell-runtime.service";
import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountParcelsLayer } from "@/features/parcels/parcels.layer";

export function initializeParcelsRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  options.layers.parcelsController.value = mountParcelsLayer(currentMap, {
    disableGuardrails: resolveDisableParcelsGuardrails(),
    maxViewportWidthKm: 500,
    maxPredictedTiles: 500,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onSelectParcel: (parcel) => {
      options.actions.setSelectedParcel(parcel);
      if (parcel !== null) {
        options.actions.clearSelectedFacility();
      }
    },
    onStatus: (status) => {
      options.state.parcelsStatus.value = status;
    },
    onViewportFacets: (facets) => {
      options.filters.onParcelViewportFacets(facets);
    },
  });

  if (options.layers.parcelsController.value !== null) {
    options.runtime.layerRuntime.value?.registerLayerController(
      PARCELS_LAYER_ID,
      options.layers.parcelsController.value
    );
  }
}

export function destroyParcelsRuntime(options: UseAppShellMapLifecycleOptions): void {
  options.runtime.layerRuntime.value?.unregisterLayerController(PARCELS_LAYER_ID);
  options.layers.parcelsController.value?.destroy();
  options.layers.parcelsController.value = null;
}
