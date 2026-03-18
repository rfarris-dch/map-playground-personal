import type { IMap, MapSourceFeature } from "@map-migration/map-engine";

const POWER_SOURCE_ID = "power.infrastructure";
const GAS_SOURCE_ID = "gas-pipelines";
const GAS_SOURCE_LAYER = "gas_pipelines";
const FIBER_METRO_SOURCE_ID = "fiber-locator.metro";
const FIBER_LONGHAUL_SOURCE_ID = "fiber-locator.longhaul";
const MAX_DISTANCE_KM = 25;
const MAX_ITEMS_PER_CATEGORY = 3;

const POWER_LAYER_IDS = [
  "power.transmission",
  "power.substations",
  "power.plants",
];

const GAS_LAYER_ID = "gas-pipelines.lines";

export interface NearbyInfrastructureItem {
  readonly label: string;
  readonly distance: string;
}

export interface NearbyInfrastructureResult {
  readonly substations: readonly NearbyInfrastructureItem[];
  readonly powerPlants: readonly NearbyInfrastructureItem[];
  readonly transmissionLines: readonly NearbyInfrastructureItem[];
  readonly gasPipelines: readonly NearbyInfrastructureItem[];
  readonly fiberRoutes: readonly NearbyInfrastructureItem[];
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  const mi = km * 0.621371;
  return `${mi.toFixed(1)} mi`;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

function props(feature: MapSourceFeature): Record<string, unknown> {
  const p = feature.properties;
  if (typeof p === "object" && p !== null) return p as Record<string, unknown>;
  return {};
}

function readPair(arr: unknown): [number, number] | null {
  if (!Array.isArray(arr) || arr.length < 2) {
    return null;
  }
  const x: unknown = arr[0];
  const y: unknown = arr[1];
  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }
  return [x, y];
}

function extractCoords(feature: MapSourceFeature): [number, number] | null {
  const geom = feature.geometry;
  if (geom.type === "Point") {
    return readPair(geom.coordinates);
  }
  if (geom.type === "LineString" || geom.type === "MultiLineString") {
    const coords =
      geom.type === "LineString" ? geom.coordinates : geom.coordinates[0];
    if (Array.isArray(coords) && coords.length > 0) {
      return readPair(coords[Math.floor(coords.length / 2)]);
    }
  }
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") {
    const ring =
      geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0]?.[0];
    if (Array.isArray(ring) && ring.length > 0) {
      let sumX = 0;
      let sumY = 0;
      for (const pt of ring) {
        if (Array.isArray(pt)) {
          sumX += pt[0] as number;
          sumY += pt[1] as number;
        }
      }
      return [sumX / ring.length, sumY / ring.length];
    }
  }
  return null;
}

function buildPowerLabel(feature: MapSourceFeature, fallback: string): string {
  const p = props(feature);
  const operator = str(p.operator) ?? str(p.owner) ?? str(p.company);
  const name = str(p.name) ?? str(p.plant_name) ?? str(p.substation) ?? str(p.ref);

  const rawVoltage = p.voltage ?? p.voltage_kv;
  let voltage: string | null = null;
  if (typeof rawVoltage === "string" && rawVoltage.trim().length > 0) {
    const kv = Number(rawVoltage.trim());
    voltage = Number.isFinite(kv) ? `${kv >= 1000 ? kv / 1000 : kv} kV` : rawVoltage.trim();
  } else if (typeof rawVoltage === "number" && Number.isFinite(rawVoltage)) {
    voltage = `${rawVoltage >= 1000 ? rawVoltage / 1000 : rawVoltage} kV`;
  }

  const parts: string[] = [];
  if (operator) parts.push(operator);
  if (name) parts.push(name);
  if (voltage) parts.push(voltage);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function buildGasLabel(feature: MapSourceFeature, fallback: string): string {
  const p = props(feature);
  const owner = str(p.owner) ?? str(p.operator) ?? str(p.name);
  const capacity = str(p.capacity) ?? str(p.capacity_bcf);

  const parts: string[] = [];
  if (owner) parts.push(owner);
  if (capacity) parts.push(capacity);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function prettifySourceLayerName(sourceLayer: string): string {
  const cleaned = sourceLayer
    .replace(/^(metro_|longhaul_|l_)/, "")
    .replace(/_/g, " ");
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function fiberTypeFromSourceLayer(sourceLayer: string): string {
  if (sourceLayer.startsWith("longhaul_") || sourceLayer.includes("_lh")) {
    return "Long Haul";
  }
  return "Metro";
}

function buildFiberLabel(sourceLayer: string, feature: MapSourceFeature, fallback: string): string {
  const p = props(feature);
  const provider =
    str(p.provider) ?? str(p.operator) ?? str(p.owner) ?? str(p.network_operator) ?? str(p.name)
    ?? prettifySourceLayerName(sourceLayer);
  const fiberType = fiberTypeFromSourceLayer(sourceLayer);
  return `${provider} · ${fiberType}`;
}

interface WithDistance {
  readonly feature: MapSourceFeature;
  readonly km: number;
}

function nearestFeatures(
  features: MapSourceFeature[],
  facilityLng: number,
  facilityLat: number
): WithDistance[] {
  const withDist = features
    .map((f) => {
      const coords = extractCoords(f);
      if (!coords) return null;
      const km = haversineKm(facilityLat, facilityLng, coords[1], coords[0]);
      if (km > MAX_DISTANCE_KM) return null;
      return { feature: f, km };
    })
    .filter((x): x is WithDistance => x !== null);
  withDist.sort((a, b) => a.km - b.km);
  return withDist;
}

function buildItems(
  sorted: WithDistance[],
  labelFn: (f: MapSourceFeature, fallback: string) => string,
  fallbackPrefix: string
): NearbyInfrastructureItem[] {
  const seen = new Set<string>();
  const result: NearbyInfrastructureItem[] = [];
  for (const { feature, km } of sorted) {
    if (result.length >= MAX_ITEMS_PER_CATEGORY) break;
    const label = labelFn(feature, `${fallbackPrefix} ${result.length + 1}`);
    if (seen.has(label)) continue;
    seen.add(label);
    result.push({ label, distance: formatDistance(km) });
  }
  return result;
}

function hasAnyVisibleLayer(map: IMap, layerIds: readonly string[]): boolean {
  return layerIds.some((id) => map.isLayerVisible(id));
}

function queryFiberSourceLayers(map: IMap, sourceId: string): string[] {
  if (!map.hasSource(sourceId)) return [];
  const style = map.getStyle();
  if (!style.layers) return [];
  const layers: string[] = [];
  for (const layer of style.layers) {
    if (
      "source" in layer &&
      layer.source === sourceId &&
      "source-layer" in layer &&
      layer["source-layer"] &&
      map.isLayerVisible(layer.id)
    ) {
      const sl = layer["source-layer"];
      if (typeof sl === "string" && !layers.includes(sl)) {
        layers.push(sl);
      }
    }
  }
  return layers;
}

export function queryNearbyInfrastructure(
  map: IMap,
  facilityLng: number,
  facilityLat: number
): NearbyInfrastructureResult | null {
  const hasPower = hasAnyVisibleLayer(map, POWER_LAYER_IDS);
  const hasGas = map.isLayerVisible(GAS_LAYER_ID);

  const fiberMetroLayers = queryFiberSourceLayers(map, FIBER_METRO_SOURCE_ID);
  const fiberLonghaulLayers = queryFiberSourceLayers(map, FIBER_LONGHAUL_SOURCE_ID);
  const hasFiber = fiberMetroLayers.length > 0 || fiberLonghaulLayers.length > 0;

  if (!hasPower && !hasGas && !hasFiber) {
    return null;
  }

  let substations: NearbyInfrastructureItem[] = [];
  let powerPlants: NearbyInfrastructureItem[] = [];
  let transmissionLines: NearbyInfrastructureItem[] = [];
  let gasPipelines: NearbyInfrastructureItem[] = [];
  let fiberRoutes: NearbyInfrastructureItem[] = [];

  if (hasPower && map.hasSource(POWER_SOURCE_ID)) {
    const subFeatures = map.querySourceFeatures(POWER_SOURCE_ID, "power_substation_point");
    const plantFeatures = map.querySourceFeatures(POWER_SOURCE_ID, "power_plant_point");
    const lineFeatures = map.querySourceFeatures(POWER_SOURCE_ID, "power_line");

    substations = buildItems(
      nearestFeatures(subFeatures, facilityLng, facilityLat),
      buildPowerLabel, "Substation"
    );
    powerPlants = buildItems(
      nearestFeatures(plantFeatures, facilityLng, facilityLat),
      buildPowerLabel, "Power Plant"
    );
    transmissionLines = buildItems(
      nearestFeatures(lineFeatures, facilityLng, facilityLat),
      buildPowerLabel, "Transmission Line"
    );
  }

  if (hasGas && map.hasSource(GAS_SOURCE_ID)) {
    const gasFeatures = map.querySourceFeatures(GAS_SOURCE_ID, GAS_SOURCE_LAYER);
    gasPipelines = buildItems(
      nearestFeatures(gasFeatures, facilityLng, facilityLat),
      buildGasLabel, "Gas Pipeline"
    );
  }

  if (hasFiber) {
    const featureSourceLayerMap = new WeakMap<MapSourceFeature, string>();
    const allFiberFeatures: MapSourceFeature[] = [];
    for (const sl of fiberMetroLayers) {
      for (const f of map.querySourceFeatures(FIBER_METRO_SOURCE_ID, sl)) {
        featureSourceLayerMap.set(f, sl);
        allFiberFeatures.push(f);
      }
    }
    for (const sl of fiberLonghaulLayers) {
      for (const f of map.querySourceFeatures(FIBER_LONGHAUL_SOURCE_ID, sl)) {
        featureSourceLayerMap.set(f, sl);
        allFiberFeatures.push(f);
      }
    }

    const fiberLabel = (f: MapSourceFeature, fallback: string): string => {
      const sl = featureSourceLayerMap.get(f) ?? "";
      return buildFiberLabel(sl, f, fallback);
    };

    fiberRoutes = buildItems(
      nearestFeatures(allFiberFeatures, facilityLng, facilityLat),
      fiberLabel, "Fiber Route"
    );
  }

  return { substations, powerPlants, transmissionLines, gasPipelines, fiberRoutes };
}
