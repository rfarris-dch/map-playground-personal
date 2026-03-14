import type { MapStyleLayer, MapStyleSpecification } from "@map-migration/map-engine";
import type { LayerId } from "@map-migration/map-layer-catalog";

export type StyleDocument = MapStyleSpecification;

export type StyleLayer = MapStyleLayer;

export type BoundaryCatalogLayerId = Extract<LayerId, "county" | "state" | "country">;

export type FloodCatalogLayerId = Extract<
  LayerId,
  "environmental.flood-100" | "environmental.flood-500"
>;

export type FacilitiesCatalogLayerId = Extract<
  LayerId,
  "facilities.colocation" | "facilities.hyperscale"
>;

export type HydroBasinsCatalogLayerId = Extract<LayerId, "environmental.hydro-basins">;

export type PowerCatalogLayerId = Extract<
  LayerId,
  "power.transmission" | "power.substations" | "power.plants"
>;

export type StaticCatalogLayerId = Exclude<
  LayerId,
  "fiber-locator.metro" | "fiber-locator.longhaul" | "infrastructure.gas-pipelines"
>;

export interface BoundaryStyleLayerIds {
  readonly fillLayerId: string;
  readonly outlineLayerId: string;
}

export interface FloodStyleLayerIds {
  readonly fill100LayerId: string;
  readonly fill500LayerId: string;
}

export interface FacilitiesStyleLayerIds {
  readonly clusterCountLayerId: string;
  readonly clusterLayerId: string;
  readonly pointLayerId: string;
}

export interface HydroBasinsStyleLayerIds {
  readonly labelLayerIds: readonly string[];
  readonly lineLayerIds: readonly string[];
}

export interface ParcelsStyleLayerIds {
  readonly fillLayerId: string;
  readonly outlineLayerId: string;
}
