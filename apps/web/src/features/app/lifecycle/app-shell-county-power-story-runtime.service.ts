import type { UseAppShellMapLifecycleOptions } from "@/features/app/lifecycle/use-app-shell-map-lifecycle.types";
import { mountCountyPowerStoryLayer } from "@/features/county-power-story/county-power-story.layer";
import { countyPowerStoryCatalogLayerIds } from "@/features/county-power-story/county-power-story.service";

function countyPowerStoryVisibilitySignature(
  visibility: UseAppShellMapLifecycleOptions["state"]["countyPowerStoryVisibility"]["value"]
): string {
  return [
    visibility.animationEnabled ? "1" : "0",
    visibility.chapterId,
    visibility.chapterVisible ? "1" : "0",
    visibility.seamHazeEnabled ? "1" : "0",
    visibility.storyId,
    visibility.threeDimensional ? "1" : "0",
    visibility.visible ? "1" : "0",
    visibility.window,
  ].join("|");
}

export function initializeCountyPowerStoryRuntime(options: UseAppShellMapLifecycleOptions): void {
  const currentMap = options.runtime.map.value;
  if (currentMap === null) {
    return;
  }

  const countyPowerStoryResult = mountCountyPowerStoryLayer(currentMap, {
    isHoverSuppressed: () =>
      options.state.hoveredFacility.value !== null ||
      options.state.hoveredFacilityCluster.value !== null,
    isInteractionEnabled: () => options.areFacilityInteractionsEnabled.value,
    onHoverChange: (nextHover) => {
      options.state.hoveredCountyPowerStory.value = nextHover;
    },
    onSelectionChange: (nextSelection) => {
      options.actions.setSelectedCountyPowerStory(nextSelection);
    },
  });

  options.layers.countyPowerStoryController.value = countyPowerStoryResult;

  const synchronizePreRegistrationState = async (): Promise<void> => {
    let lastAppliedSignature: string | null = null;

    while (true) {
      const requestedVisibility = options.state.countyPowerStoryVisibility.value;
      const signature = countyPowerStoryVisibilitySignature(requestedVisibility);

      if (signature === lastAppliedSignature) {
        return;
      }

      lastAppliedSignature = signature;
      countyPowerStoryResult.controller.setAnimationEnabled(requestedVisibility.animationEnabled);
      await countyPowerStoryResult.controller.setStoryId(requestedVisibility.storyId);
      await countyPowerStoryResult.controller.setWindow(requestedVisibility.window);

      const latestVisibility = options.state.countyPowerStoryVisibility.value;
      countyPowerStoryResult.controller.setAnimationEnabled(latestVisibility.animationEnabled);
      await countyPowerStoryResult.controller.setChapterId(latestVisibility.chapterId);
      await countyPowerStoryResult.controller.setChapterVisible(latestVisibility.chapterVisible);
      countyPowerStoryResult.controller.setSeamHazeEnabled(latestVisibility.seamHazeEnabled);
      countyPowerStoryResult.controller.setThreeDimensionalEnabled(
        latestVisibility.threeDimensional
      );
      await countyPowerStoryResult.controller.setVisible(latestVisibility.visible);
    }
  };

  synchronizePreRegistrationState()
    .then(() => {
      for (const layerId of countyPowerStoryCatalogLayerIds()) {
        options.runtime.layerRuntime.value?.registerLayerController(
          layerId,
          countyPowerStoryResult.controllers[layerId]
        );
      }

      const currentVisibility = options.state.countyPowerStoryVisibility.value;
      countyPowerStoryResult.controller.setAnimationEnabled(currentVisibility.animationEnabled);
      countyPowerStoryResult.controller.setSeamHazeEnabled(currentVisibility.seamHazeEnabled);
      countyPowerStoryResult.controller.setThreeDimensionalEnabled(
        currentVisibility.threeDimensional
      );

      return countyPowerStoryResult.controller.setVisible(currentVisibility.visible);
    })
    .catch((error: unknown) => {
      console.error("[county-power-story] runtime initialization failed", error);
    });

  const selectedCounty = options.state.selectedCountyPowerStory.value;
  if (selectedCounty !== null) {
    countyPowerStoryResult.controller.setSelectedCounty(selectedCounty.countyFips);
  }
}

export function destroyCountyPowerStoryRuntime(options: UseAppShellMapLifecycleOptions): void {
  for (const layerId of countyPowerStoryCatalogLayerIds()) {
    options.runtime.layerRuntime.value?.unregisterLayerController(layerId);
  }

  options.state.hoveredCountyPowerStory.value = null;
  options.layers.countyPowerStoryController.value?.destroy();
  options.layers.countyPowerStoryController.value = null;
}
