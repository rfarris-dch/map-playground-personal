import type { FiberLocatorLayer } from "@map-migration/http-contracts";
import type {
  FiberLocatorLineId,
  FiberLocatorSourceLayerOption,
  FiberLocatorStatus,
} from "@/features/fiber-locator/fiber-locator.types";

export function initialFiberLocatorStatus(): FiberLocatorStatus {
  return {
    state: "idle",
  };
}

export function formatFiberLocatorStatus(status: FiberLocatorStatus): string {
  if (status.state === "idle") {
    return "Fiber layers: not loaded";
  }

  if (status.state === "loading") {
    return "Fiber layers: loading catalog";
  }

  if (status.state === "error") {
    return `Fiber layers: ${status.reason} (requestId=${status.requestId})`;
  }

  return `Fiber layers: ok (count=${String(status.count)}, requestId=${status.requestId})`;
}

export function fiberLocatorLineColor(lineId: FiberLocatorLineId): string {
  if (lineId === "metro") {
    return "#ec4899";
  }

  return "#06b6d4";
}

export function fiberLocatorLineLabel(lineId: FiberLocatorLineId): string {
  return lineId === "metro" ? "Metro" : "Longhaul";
}

export function getFiberLocatorSourceLayerOptions(
  layers: readonly FiberLocatorLayer[],
  lineId: FiberLocatorLineId
): readonly FiberLocatorSourceLayerOption[] {
  const sourceLayerOptions: FiberLocatorSourceLayerOption[] = [];
  const seen = new Set<string>();

  for (const layer of layers) {
    const branch = layer.branch?.trim().toLowerCase() ?? null;
    if (branch !== lineId) {
      continue;
    }

    const layerName = layer.layerName.trim().toLowerCase();
    if (layerName.length === 0) {
      continue;
    }

    if (seen.has(layerName)) {
      continue;
    }

    seen.add(layerName);
    sourceLayerOptions.push({
      color: layer.color,
      label: layer.commonName.trim().length > 0 ? layer.commonName.trim() : layerName,
      layerName,
    });
  }

  sourceLayerOptions.sort((left, right) => {
    const labelResult = left.label.localeCompare(right.label);
    if (labelResult !== 0) {
      return labelResult;
    }

    return left.layerName.localeCompare(right.layerName);
  });

  return sourceLayerOptions;
}
