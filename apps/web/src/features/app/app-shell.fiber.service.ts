import type {
  FiberSourceLayerOptionsState,
  FiberSourceLayerSelectionState,
} from "@/features/app/app-shell.types";
import type {
  FiberLocatorLineId,
  FiberLocatorSourceLayerOption,
} from "@/features/fiber-locator/fiber-locator.types";

function normalizedLayerNameSet(layerNames: readonly string[]): Set<string> {
  return new Set(layerNames.map((layerName) => layerName.trim().toLowerCase()));
}

export function normalizeSelectedFiberLayerNamesForOptions(
  options: readonly FiberLocatorSourceLayerOption[],
  selectedLayerNames: readonly string[]
): readonly string[] {
  const selectedLayerNamesSet = normalizedLayerNameSet(selectedLayerNames);

  return options
    .map((option) => option.layerName)
    .filter((layerName) => selectedLayerNamesSet.has(layerName.toLowerCase()));
}

export function areAllFiberSourceLayersSelected(
  options: readonly FiberLocatorSourceLayerOption[],
  selectedLayerNames: readonly string[]
): boolean {
  if (options.length === 0) {
    return false;
  }

  const selectedLayerNamesSet = normalizedLayerNameSet(selectedLayerNames);
  return options.every((option) => selectedLayerNamesSet.has(option.layerName.toLowerCase()));
}

export function selectedFiberSourceLayers(
  options: readonly FiberLocatorSourceLayerOption[],
  selectedLayerNames: readonly string[]
): readonly FiberLocatorSourceLayerOption[] {
  const selectedLayerNamesSet = normalizedLayerNameSet(selectedLayerNames);
  return options.filter((option) => selectedLayerNamesSet.has(option.layerName.toLowerCase()));
}

export function filterFiberSourceLayerOptionsByInView(
  allOptions: FiberSourceLayerOptionsState,
  inViewLayerNames: readonly string[]
): FiberSourceLayerOptionsState {
  const inViewLayerNamesSet = normalizedLayerNameSet(inViewLayerNames);

  return {
    metro: allOptions.metro.filter((option) =>
      inViewLayerNamesSet.has(option.layerName.toLowerCase())
    ),
    longhaul: allOptions.longhaul.filter((option) =>
      inViewLayerNamesSet.has(option.layerName.toLowerCase())
    ),
  };
}

export function nextSelectedFiberLayerNamesForToggle(
  options: readonly FiberLocatorSourceLayerOption[],
  selectedLayerNames: readonly string[],
  layerName: string,
  visible: boolean
): readonly string[] {
  const normalizedLayerName = layerName.trim().toLowerCase();
  if (normalizedLayerName.length === 0) {
    return selectedLayerNames;
  }

  const selectedLayerNamesSet = normalizedLayerNameSet(selectedLayerNames);
  if (visible) {
    selectedLayerNamesSet.add(normalizedLayerName);
  } else {
    selectedLayerNamesSet.delete(normalizedLayerName);
  }

  return options
    .map((option) => option.layerName)
    .filter((optionLayerName) => selectedLayerNamesSet.has(optionLayerName.toLowerCase()));
}

export function selectedFiberLayerNamesForLine(
  selectedLayerNames: FiberSourceLayerSelectionState,
  lineId: FiberLocatorLineId
): readonly string[] {
  return selectedLayerNames[lineId];
}
