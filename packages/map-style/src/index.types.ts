import type { MapStyleLayer, MapStyleSpecification } from "@map-migration/map-engine";
import type { LayerId } from "@map-migration/map-layer-catalog";

export type StyleDocument = MapStyleSpecification;

export type StyleLayer = MapStyleLayer;

export type BoundaryCatalogLayerId = Extract<LayerId, "county" | "state" | "country">;

export type FacilitiesCatalogLayerId = Extract<
  LayerId,
  "facilities.colocation" | "facilities.hyperscale"
>;

export type PowerCatalogLayerId = Extract<
  LayerId,
  "power.transmission" | "power.substations" | "power.plants"
>;

export type StaticCatalogLayerId = Exclude<
  LayerId,
  "fiber-locator.metro" | "fiber-locator.longhaul"
>;

export interface BoundaryStyleLayerIds {
  readonly fillLayerId: string;
  readonly outlineLayerId: string;
}

export interface FacilitiesStyleLayerIds {
  readonly clusterCountLayerId: string;
  readonly clusterLayerId: string;
  readonly pointLayerId: string;
}

export interface ParcelsStyleLayerIds {
  readonly fillLayerId: string;
  readonly outlineLayerId: string;
}
