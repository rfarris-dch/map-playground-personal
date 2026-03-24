import type { LocationQueryRaw } from "vue-router";
import {
  buildMapContextTransferFromAppShell,
  buildMapContextTransferQuery,
  normalizeMapContextTransferQuery,
  readMapContextTransferTokenFromQuery,
  replaceMapContextTransferQuery,
} from "@/features/map-context-transfer/map-context-transfer.service";
import type { UseAppShellUrlStateOptions } from "./app-shell-url-state.types";

export function buildAppShellUrlStateQuery(
  options: UseAppShellUrlStateOptions,
  currentQuery: LocationQueryRaw,
  preferredContextToken?: string
): LocationQueryRaw {
  const mapContext = buildMapContextTransferFromAppShell({
    basemapVisibility: options.basemapVisibility.value,
    boundaryFacetSelection: options.boundaryFacetSelection.value,
    boundaryVisibility: options.boundaryVisibility.value,
    countyPowerStoryVisibility: options.countyPowerStoryVisibility.value,
    fiberVisibility: options.fiberVisibility.value,
    floodVisibility: options.floodVisibility.value,
    gasPipelineVisible: options.gasPipelineVisible.value,
    hydroBasinsVisible: options.hydroBasinsVisible.value,
    layerRuntimeSnapshot: options.layerRuntimeSnapshot.value,
    map: options.map.value,
    parcelsVisible: options.parcelsVisible.value,
    perspectiveViewModes: options.perspectiveViewModes.value,
    powerVisibility: options.powerVisibility.value,
    selectedFiberSourceLayerNames: options.selectedFiberSourceLayerNames.value,
    sourceSurface: options.currentSurface.value,
    targetSurface: options.currentSurface.value,
    visiblePerspectives: options.visiblePerspectives.value,
    waterVisible: options.waterVisible.value,
    mapFilters: options.mapFilters.value,
  });

  const activeContextToken =
    preferredContextToken ?? readMapContextTransferTokenFromQuery(currentQuery);

  return replaceMapContextTransferQuery(
    currentQuery,
    buildMapContextTransferQuery(mapContext, undefined, activeContextToken)
  );
}

export function serializeNormalizedMapContextQuery(query: LocationQueryRaw): string {
  const normalizedQuery = normalizeMapContextTransferQuery(query);
  const sortedEntries = Object.entries(normalizedQuery).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );
  return JSON.stringify(sortedEntries);
}
