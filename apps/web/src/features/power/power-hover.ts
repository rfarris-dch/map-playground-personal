import type { IMap, MapPointerEvent } from "@map-migration/map-engine";
import { powerLayerMetadata } from "./power.service";
import type {
  PowerHoverController,
  PowerHoverLayerId,
  PowerHoverOptions,
  PowerHoverState,
} from "./power-hover.types";

interface HoverTarget {
  readonly featureId: number | string;
  readonly sourceId: string;
  readonly sourceLayerName: string;
}

interface HoverCandidate {
  readonly nextHover: PowerHoverState;
  readonly nextTarget: HoverTarget | null;
}

const POWER_HOVER_QUERY_LAYER_IDS: readonly string[] = [
  "power.substations",
  "power.plants",
  "power.substations-area",
  "power.plants-area",
];
const POWER_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/u;

function isFeatureId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

function readStringProperty(properties: unknown, key: string): string | null {
  const value = readProperty(properties, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readFirstAvailableString(properties: unknown, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = readStringProperty(properties, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

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

function readFeatureSource(feature: { source?: unknown }): string | null {
  if (typeof feature.source !== "string") {
    return null;
  }

  const normalized = feature.source.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readFeatureStyleLayerId(feature: { layer?: unknown }): string | null {
  if (typeof feature.layer !== "object" || feature.layer === null) {
    return null;
  }

  const layerId = Reflect.get(feature.layer, "id");
  if (typeof layerId !== "string") {
    return null;
  }

  const normalized = layerId.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readFeatureSourceLayerName(feature: {
  properties?: unknown;
  sourceLayer?: unknown;
}): string | null {
  if (typeof feature.sourceLayer === "string") {
    const normalized = feature.sourceLayer.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const layerNameFromProperties = readStringProperty(feature.properties, "layer_name");
  if (layerNameFromProperties !== null) {
    return layerNameFromProperties;
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
}): HoverTarget | null {
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
    sourceId,
    sourceLayerName,
    featureId: feature.id,
  };
}

function isSameHoverTarget(left: HoverTarget | null, right: HoverTarget): boolean {
  if (left === null) {
    return false;
  }

  return (
    left.sourceId === right.sourceId &&
    left.sourceLayerName === right.sourceLayerName &&
    left.featureId === right.featureId
  );
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

function resolveHoverCandidate(map: IMap, event: MapPointerEvent): HoverCandidate | null {
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

function toFeatureStateTarget(target: HoverTarget): {
  id: number | string;
  source: string;
  sourceLayer: string;
} {
  return {
    source: target.sourceId,
    sourceLayer: target.sourceLayerName,
    id: target.featureId,
  };
}

export function mountPowerHover(map: IMap, options: PowerHoverOptions): PowerHoverController {
  let hoverTarget: HoverTarget | null = null;

  const clearFeatureState = (): void => {
    if (hoverTarget === null) {
      return;
    }

    map.setFeatureState(toFeatureStateTarget(hoverTarget), { hover: false });
    hoverTarget = null;
  };

  const clear = (): void => {
    clearFeatureState();
    options.onHoverChange?.(null);
  };

  const onPointerLeave = (): void => {
    clear();
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!(options.isInteractionEnabled?.() ?? true)) {
      clear();
      return;
    }

    const candidate = resolveHoverCandidate(map, event);
    if (candidate === null) {
      clear();
      return;
    }

    if (candidate.nextTarget !== null && isSameHoverTarget(hoverTarget, candidate.nextTarget)) {
      options.onHoverChange?.(candidate.nextHover);
      return;
    }

    if (candidate.nextTarget === null && hoverTarget === null) {
      options.onHoverChange?.(candidate.nextHover);
      return;
    }

    clearFeatureState();

    if (candidate.nextTarget !== null) {
      map.setFeatureState(toFeatureStateTarget(candidate.nextTarget), { hover: true });
      hoverTarget = candidate.nextTarget;
    }

    options.onHoverChange?.(candidate.nextHover);
  };

  map.onPointerMove(onPointerMove);
  map.onPointerLeave(onPointerLeave);

  return {
    clear,
    destroy(): void {
      clear();
      map.offPointerMove(onPointerMove);
      map.offPointerLeave(onPointerLeave);
    },
  };
}
