import type { FiberLocatorLayer } from "@map-migration/http-contracts/fiber-locator-http";
import type { FiberLocatorUpstreamLayer } from "@/geo/fiber-locator/fiber-locator.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = Reflect.get(record, key);
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeUpstreamLayer(value: unknown): FiberLocatorUpstreamLayer | null {
  if (!isRecord(value)) {
    return null;
  }

  const layerName = readString(value, "layer_name");
  if (layerName === null) {
    return null;
  }

  const commonName = readString(value, "common_name") ?? layerName;
  const branch = readNullableString(value, "branch");
  const geomType = readNullableString(value, "geom_type");
  const color = readNullableString(value, "color");

  return {
    layerName,
    commonName,
    branch,
    geomType,
    color,
  };
}

export function normalizeUpstreamLayerName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

export function toCatalogLayer(layer: FiberLocatorUpstreamLayer): FiberLocatorLayer {
  return {
    layerName: layer.layerName,
    commonName: layer.commonName,
    branch: layer.branch,
    geomType: layer.geomType,
    color: layer.color,
  };
}

export function createLineSortOrder(lineIds: readonly string[]): Map<string, number> {
  return lineIds.reduce((sortOrder, lineId, index) => {
    sortOrder.set(lineId.toLowerCase(), index);
    return sortOrder;
  }, new Map<string, number>());
}

export function layerLineSortIndex(
  layer: FiberLocatorUpstreamLayer,
  lineSortOrder: ReadonlyMap<string, number>
): number {
  const branch = layer.branch?.toLowerCase() ?? null;
  if (branch !== null) {
    const branchIndex = lineSortOrder.get(branch);
    if (typeof branchIndex === "number") {
      return branchIndex;
    }
  }

  const layerName = layer.layerName.toLowerCase();
  const layerNameIndex = lineSortOrder.get(layerName);
  if (typeof layerNameIndex === "number") {
    return layerNameIndex;
  }

  return lineSortOrder.size;
}

export function payloadRecordOrThrow(payload: unknown, context: string): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new Error(`${context} payload was not an object`);
  }

  return payload;
}
