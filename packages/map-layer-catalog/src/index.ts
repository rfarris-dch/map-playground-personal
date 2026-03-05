export type LayerId =
  | "county"
  | "state"
  | "country"
  | "facilities.colocation"
  | "facilities.hyperscale"
  | "power.transmission"
  | "power.substations"
  | "power.plants"
  | "fiber-locator.longhaul"
  | "fiber-locator.metro"
  | "property.parcels";

export const LAYER_IDS: readonly LayerId[] = [
  "county",
  "state",
  "country",
  "facilities.colocation",
  "facilities.hyperscale",
  "power.transmission",
  "power.substations",
  "power.plants",
  "fiber-locator.metro",
  "fiber-locator.longhaul",
  "property.parcels",
];

export type LayerGroup =
  | "basemap"
  | "boundaries"
  | "facilities"
  | "infrastructure"
  | "environmental"
  | "parcels"
  | "models";

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

export type LayerCatalog = Readonly<Record<LayerId, LayerDefinition>>;

export const DEFAULT_LAYER_CATALOG: LayerCatalog = {
  // Boundary layers are cataloged for governance, but feature layers are independently toggleable.
  county: {
    id: "county",
    group: "boundaries",
    sourceId: "county",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  state: {
    id: "state",
    group: "boundaries",
    sourceId: "state",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  country: {
    id: "country",
    group: "boundaries",
    sourceId: "country",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "facilities.colocation": {
    id: "facilities.colocation",
    group: "facilities",
    sourceId: "facilities.colocation",
    sourceType: "geojson",
    zoomMin: 4,
    zoomMax: 22,
    defaultVisible: true,
    dependencies: [],
    budgetWeight: 2,
  },
  "facilities.hyperscale": {
    id: "facilities.hyperscale",
    group: "facilities",
    sourceId: "facilities.hyperscale",
    sourceType: "geojson",
    zoomMin: 4,
    zoomMax: 22,
    defaultVisible: true,
    dependencies: [],
    budgetWeight: 2,
  },
  "power.transmission": {
    id: "power.transmission",
    group: "infrastructure",
    sourceId: "power.transmission",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "power.substations": {
    id: "power.substations",
    group: "infrastructure",
    sourceId: "power.substations",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "power.plants": {
    id: "power.plants",
    group: "infrastructure",
    sourceId: "power.plants",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "fiber-locator.metro": {
    id: "fiber-locator.metro",
    group: "infrastructure",
    sourceId: "fiber-locator.metro",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "fiber-locator.longhaul": {
    id: "fiber-locator.longhaul",
    group: "infrastructure",
    sourceId: "fiber-locator.longhaul",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "property.parcels": {
    id: "property.parcels",
    group: "parcels",
    sourceId: "parcels",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: true,
    dependencies: [],
    budgetWeight: 5,
  },
};

export function isLayerId(value: string): value is LayerId {
  return (
    value === "county" ||
    value === "state" ||
    value === "country" ||
    value === "facilities.colocation" ||
    value === "facilities.hyperscale" ||
    value === "power.transmission" ||
    value === "power.substations" ||
    value === "power.plants" ||
    value === "fiber-locator.metro" ||
    value === "fiber-locator.longhaul" ||
    value === "property.parcels"
  );
}

export function validateLayerCatalog(catalog: LayerCatalog): string[] {
  const errors: string[] = [];
  const boundaryLayerIds: readonly LayerId[] = ["county", "state", "country"];

  for (const layerId of LAYER_IDS) {
    const layer = catalog[layerId];
    if (layer.id !== layerId) {
      errors.push(`Layer key mismatch: key=${layerId} layer.id=${layer.id}`);
    }
    if (layer.zoomMin > layer.zoomMax) {
      errors.push(`Invalid zoom range for ${layerId}: ${layer.zoomMin} > ${layer.zoomMax}`);
    }
    for (const dep of layer.dependencies) {
      if (typeof catalog[dep] === "undefined") {
        errors.push(`Unknown dependency for ${layerId}: ${dep}`);
      }

      const nonBoundaryLayerDependsOnBoundary =
        !boundaryLayerIds.includes(layerId) && boundaryLayerIds.includes(dep);
      if (nonBoundaryLayerDependsOnBoundary) {
        errors.push(`Invalid boundary dependency for ${layerId}: ${dep}`);
      }
    }
  }

  return errors;
}

export function visibleLayerCount(catalog: LayerCatalog): number {
  let visible = 0;
  for (const layerId of LAYER_IDS) {
    if (catalog[layerId].defaultVisible) {
      visible += 1;
    }
  }

  return visible;
}
