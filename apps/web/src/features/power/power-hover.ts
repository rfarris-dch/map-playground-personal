import type { FeatureStateTarget, IMap, MapPointerEvent } from "@map-migration/map-engine";
import { powerLayerMetadata } from "@/features/power/power.service";
import type {
  PowerHoverController,
  PowerHoverLayerId,
  PowerHoverOptions,
  PowerHoverState,
} from "@/features/power/power-hover.types";
import { createFeatureHoverController } from "@/lib/map-feature-hover.service";
import {
  isFeatureId,
  readFeatureSource,
  readFeatureSourceLayerName,
  readFeatureStyleLayerId,
  readFirstAvailableString,
  readProperty,
} from "@/lib/map-feature-readers";

const POWER_HOVER_QUERY_LAYER_IDS: readonly string[] = [
  "power.substations",
  "power.plants",
  "power.substations-area",
  "power.plants-area",
];
const POWER_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/u;

function parseNumberFromString(value: string): number | null {
  const match = value.match(POWER_NUMBER_PATTERN);
  if (match === null) {
    return null;
  }

  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseNumberValue(value: unknown): {
  readonly raw: string | null;
  readonly value: number;
} | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      value,
      raw: null,
    };
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = parseNumberFromString(normalized);
    if (parsed === null) {
      return null;
    }

    return {
      value: parsed,
      raw: normalized,
    };
  }

  return null;
}

function normalizeMegawatts(value: number, raw: string | null): number {
  if (raw === null) {
    return value;
  }

  const normalizedRaw = raw.toLowerCase();
  if (normalizedRaw.includes("gw")) {
    return value * 1000;
  }

  if (normalizedRaw.includes("kw")) {
    return value / 1000;
  }

  return value;
}

function normalizeVoltageKilovolts(value: number): number {
  if (value >= 2000) {
    return value / 1000;
  }

  return value;
}

function readFirstAvailableNumber(
  properties: unknown,
  keys: readonly string[]
): {
  readonly raw: string | null;
  readonly value: number;
} | null {
  for (const key of keys) {
    const candidate = parseNumberValue(readProperty(properties, key));
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function toHoverLayerId(styleLayerId: string): PowerHoverLayerId | null {
  if (styleLayerId.startsWith("power.substations")) {
    return "substations";
  }

  if (styleLayerId.startsWith("power.plants")) {
    return "plants";
  }

  return null;
}

function readOutputMegawatts(properties: unknown): number | null {
  const output = readFirstAvailableNumber(properties, [
    "plant:output:electricity",
    "generator:output:electricity",
    "output",
    "capacity_mw",
    "capacity",
    "mw",
  ]);

  if (output === null) {
    return null;
  }

  return normalizeMegawatts(output.value, output.raw);
}

function readVoltageKilovolts(properties: unknown): number | null {
  const voltage = readFirstAvailableNumber(properties, ["voltage", "voltage_kv"]);
  if (voltage === null) {
    return null;
  }

  return normalizeVoltageKilovolts(voltage.value);
}

function toHoverState(
  feature: {
    id: unknown;
    layer?: unknown;
    properties?: unknown;
  },
  screenPoint: readonly [number, number]
): PowerHoverState | null {
  const styleLayerId = readFeatureStyleLayerId(feature);
  if (styleLayerId === null) {
    return null;
  }

  const layerId = toHoverLayerId(styleLayerId);
  if (layerId === null) {
    return null;
  }

  const metadata = powerLayerMetadata(layerId);

  return {
    featureId: isFeatureId(feature.id) ? feature.id : null,
    layerId,
    layerLabel: metadata.label,
    name: readFirstAvailableString(feature.properties, ["name", "plant_name", "substation", "ref"]),
    operatorName: readFirstAvailableString(feature.properties, [
      "operator",
      "owner",
      "company",
      "network_operator",
    ]),
    status: readFirstAvailableString(feature.properties, [
      "status",
      "operational_status",
      "plant:status",
    ]),
    sourceDetail: readFirstAvailableString(feature.properties, [
      "plant:source",
      "generator:source",
      "source",
      "fuel",
      "plant:method",
    ]),
    outputMw: readOutputMegawatts(feature.properties),
    voltageKv: readVoltageKilovolts(feature.properties),
    sourceLayerName: readFeatureSourceLayerName(feature),
    screenPoint,
  };
}

function toHoverTarget(feature: {
  id: unknown;
  source?: unknown;
  sourceLayer?: unknown;
  properties?: unknown;
}): FeatureStateTarget | null {
  if (!isFeatureId(feature.id)) {
    return null;
  }

  const sourceId = readFeatureSource(feature);
  if (sourceId === null) {
    return null;
  }

  const sourceLayerName = readFeatureSourceLayerName(feature);
  if (sourceLayerName === null) {
    return null;
  }

  return {
    source: sourceId,
    sourceLayer: sourceLayerName,
    id: feature.id,
  };
}

function queryLayerIds(map: IMap): string[] {
  const layers: string[] = [];
  for (const layerId of POWER_HOVER_QUERY_LAYER_IDS) {
    if (map.hasLayer(layerId)) {
      layers.push(layerId);
    }
  }

  return layers;
}

function resolveHoverCandidate(
  map: IMap,
  event: MapPointerEvent
): {
  readonly nextHover: PowerHoverState;
  readonly nextTarget: FeatureStateTarget | null;
} | null {
  const layers = queryLayerIds(map);
  if (layers.length === 0) {
    return null;
  }

  const features = map.queryRenderedFeatures(event.point, { layers });
  const screenPoint: readonly [number, number] = [event.point[0], event.point[1]];

  for (const feature of features) {
    const nextHover = toHoverState(feature, screenPoint);
    if (nextHover === null) {
      continue;
    }

    return {
      nextHover,
      nextTarget: toHoverTarget(feature),
    };
  }

  return null;
}

export function mountPowerHover(map: IMap, options: PowerHoverOptions): PowerHoverController {
  return createFeatureHoverController(map, {
    isInteractionEnabled: options.isInteractionEnabled,
    onHoverChange: options.onHoverChange,
    resolveHoverCandidate(event) {
      return resolveHoverCandidate(map, event);
    },
  });
}
