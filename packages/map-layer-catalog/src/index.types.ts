export type LayerCatalog = Readonly<Record<LayerId, LayerDefinition>>;

export interface LayerDefinition {
  readonly budgetWeight: number;
  readonly defaultVisible: boolean;
  readonly dependencies: readonly LayerId[];
  readonly group: LayerGroup;
  readonly id: LayerId;
  readonly sourceId: string;
  readonly sourceType: "vector" | "raster" | "geojson" | "custom";
  readonly zoomMax: number;
  readonly zoomMin: number;
}

export type LayerGroup =
  | "basemap"
  | "boundaries"
  | "facilities"
  | "infrastructure"
  | "environmental"
  | "parcels"
  | "models";

export type LayerId =
  | "county"
  | "state"
  | "country"
  | "environmental.water-features"
  | "facilities.colocation"
  | "facilities.hyperscale"
  | "power.transmission"
  | "power.substations"
  | "power.plants"
  | "fiber-locator.longhaul"
  | "fiber-locator.metro"
  | "property.parcels";
