import { DEFAULT_LAYER_CATALOG, type LayerCatalog } from "@map-migration/map-layer-catalog";
import {
  FLOOD_100_LAYER_ID,
  FLOOD_500_LAYER_ID,
  facilitiesLayerId,
  fiberLayerId,
  HYDRO_BASINS_LAYER_ID,
  PARCELS_LAYER_ID,
  powerLayerId,
  WATER_FEATURES_LAYER_ID,
} from "@/features/app/core/app-shell.constants";
import type {
  BoundaryVisibilityState,
  FiberVisibilityState,
  FloodVisibilityState,
  PerspectiveVisibilityState,
} from "@/features/app/core/app-shell.types";
import { defaultBasemapVisibilityState } from "@/features/basemap/basemap.service";
import type { BasemapVisibilityState } from "@/features/basemap/basemap.types";
import type { BoundaryLayerId } from "@/features/boundaries/boundaries.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";
import type { PowerLayerId, PowerVisibilityState } from "@/features/power/power.types";

function readCatalogDefaultVisible(
  layerId: keyof LayerCatalog,
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): boolean {
  return catalog[layerId].defaultVisible;
}

function readRuntimeUserVisible(
  runtime: LayerRuntimeController | null,
  layerId: keyof LayerCatalog,
  fallback: boolean
): boolean {
  if (runtime === null) {
    return fallback;
  }

  return runtime.getUserVisible(layerId);
}

export function buildInitialPerspectiveVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): PerspectiveVisibilityState {
  return {
    colocation: readCatalogDefaultVisible(facilitiesLayerId("colocation"), catalog),
    hyperscale: readCatalogDefaultVisible(facilitiesLayerId("hyperscale"), catalog),
  };
}

export function buildInitialBoundaryVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): BoundaryVisibilityState {
  return {
    county: readCatalogDefaultVisible("county", catalog),
    state: readCatalogDefaultVisible("state", catalog),
    country: readCatalogDefaultVisible("country", catalog),
  };
}

export function buildInitialFloodVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): FloodVisibilityState {
  return {
    flood100: readCatalogDefaultVisible(FLOOD_100_LAYER_ID, catalog),
    flood500: readCatalogDefaultVisible(FLOOD_500_LAYER_ID, catalog),
  };
}

export function buildInitialFiberVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): FiberVisibilityState {
  return {
    metro: readCatalogDefaultVisible(fiberLayerId("metro"), catalog),
    longhaul: readCatalogDefaultVisible(fiberLayerId("longhaul"), catalog),
  };
}

export function buildInitialPowerVisibilityState(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): PowerVisibilityState {
  return {
    transmission: readCatalogDefaultVisible(powerLayerId("transmission"), catalog),
    substations: readCatalogDefaultVisible(powerLayerId("substations"), catalog),
    plants: readCatalogDefaultVisible(powerLayerId("plants"), catalog),
  };
}

export function buildInitialParcelsVisible(catalog: LayerCatalog = DEFAULT_LAYER_CATALOG): boolean {
  return readCatalogDefaultVisible(PARCELS_LAYER_ID, catalog);
}

export function buildInitialWaterVisible(catalog: LayerCatalog = DEFAULT_LAYER_CATALOG): boolean {
  return readCatalogDefaultVisible(WATER_FEATURES_LAYER_ID, catalog);
}

export function buildInitialHydroBasinsVisible(
  catalog: LayerCatalog = DEFAULT_LAYER_CATALOG
): boolean {
  return readCatalogDefaultVisible(HYDRO_BASINS_LAYER_ID, catalog);
}

export function buildInitialBasemapVisibilityState(): BasemapVisibilityState {
  return defaultBasemapVisibilityState();
}

export function syncPerspectiveVisibilityState(args: {
  readonly fallback: PerspectiveVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): PerspectiveVisibilityState {
  return {
    colocation: readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("colocation"),
      args.fallback.colocation
    ),
    hyperscale: readRuntimeUserVisible(
      args.runtime,
      facilitiesLayerId("hyperscale"),
      args.fallback.hyperscale
    ),
  };
}

export function syncBoundaryVisibilityState(args: {
  readonly fallback: BoundaryVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): BoundaryVisibilityState {
  return {
    county: readRuntimeUserVisible(args.runtime, "county", args.fallback.county),
    state: readRuntimeUserVisible(args.runtime, "state", args.fallback.state),
    country: readRuntimeUserVisible(args.runtime, "country", args.fallback.country),
  };
}

export function syncFloodVisibilityState(args: {
  readonly fallback: FloodVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): FloodVisibilityState {
  return {
    flood100: readRuntimeUserVisible(args.runtime, FLOOD_100_LAYER_ID, args.fallback.flood100),
    flood500: readRuntimeUserVisible(args.runtime, FLOOD_500_LAYER_ID, args.fallback.flood500),
  };
}

export function syncPowerVisibilityState(args: {
  readonly fallback: PowerVisibilityState;
  readonly runtime: LayerRuntimeController | null;
}): PowerVisibilityState {
  return {
    transmission: readRuntimeUserVisible(
      args.runtime,
      powerLayerId("transmission"),
      args.fallback.transmission
    ),
    substations: readRuntimeUserVisible(
      args.runtime,
      powerLayerId("substations"),
      args.fallback.substations
    ),
    plants: readRuntimeUserVisible(args.runtime, powerLayerId("plants"), args.fallback.plants),
  };
}

export function syncParcelsVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, PARCELS_LAYER_ID, args.fallback);
}

export function syncWaterVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, WATER_FEATURES_LAYER_ID, args.fallback);
}

export function syncHydroBasinsVisible(args: {
  readonly fallback: boolean;
  readonly runtime: LayerRuntimeController | null;
}): boolean {
  return readRuntimeUserVisible(args.runtime, HYDRO_BASINS_LAYER_ID, args.fallback);
}

export function withPerspectiveVisibility(args: {
  readonly perspective: keyof PerspectiveVisibilityState;
  readonly state: PerspectiveVisibilityState;
  readonly visible: boolean;
}): PerspectiveVisibilityState {
  return {
    ...args.state,
    [args.perspective]: args.visible,
  };
}

export function withBoundaryVisibility(args: {
  readonly boundaryId: BoundaryLayerId;
  readonly state: BoundaryVisibilityState;
  readonly visible: boolean;
}): BoundaryVisibilityState {
  return {
    ...args.state,
    [args.boundaryId]: args.visible,
  };
}

export function withFloodVisibility(args: {
  readonly layerId: keyof FloodVisibilityState;
  readonly state: FloodVisibilityState;
  readonly visible: boolean;
}): FloodVisibilityState {
  return {
    ...args.state,
    [args.layerId]: args.visible,
  };
}

export function withPowerVisibility(args: {
  readonly layerId: PowerLayerId;
  readonly state: PowerVisibilityState;
  readonly visible: boolean;
}): PowerVisibilityState {
  return {
    ...args.state,
    [args.layerId]: args.visible,
  };
}
