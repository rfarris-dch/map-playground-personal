function defineLayerIds<const TLayerIds extends readonly string[]>(layerIds: TLayerIds): TLayerIds {
  return layerIds;
}

export const LAYER_IDS = defineLayerIds([
  "county",
  "state",
  "country",
  "environmental.flood-100",
  "environmental.flood-500",
  "environmental.hydro-basins",
  "environmental.water-features",
  "facilities.colocation",
  "facilities.hyperscale",
  "facilities.hyperscale-leased",
  "facilities.enterprise",
  "infrastructure.gas-pipelines",
  "markets.market",
  "markets.submarket",
  "models.county-power-grid-stress",
  "models.county-power-queue-pressure",
  "models.county-power-market-structure",
  "models.county-power-policy-watch",
  "models.county-power-3d",
  "power.transmission",
  "power.substations",
  "power.plants",
  "fiber-locator.metro",
  "fiber-locator.longhaul",
  "property.parcels",
]);

const layerIdLookup: ReadonlySet<string> = new Set(LAYER_IDS);

export type LayerId = (typeof LAYER_IDS)[number];

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
  | "markets"
  | "parcels"
  | "models";

export const DEFAULT_LAYER_CATALOG: LayerCatalog = {
  county: {
    id: "county",
    group: "boundaries",
    sourceId: "boundaries.county.source",
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
    sourceId: "boundaries.state.source",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: true,
    dependencies: [],
    budgetWeight: 1,
  },
  country: {
    id: "country",
    group: "boundaries",
    sourceId: "boundaries.country.source",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "environmental.flood-100": {
    id: "environmental.flood-100",
    group: "environmental",
    sourceId: "environmental-flood",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "environmental.flood-500": {
    id: "environmental.flood-500",
    group: "environmental",
    sourceId: "environmental-flood",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "environmental.hydro-basins": {
    id: "environmental.hydro-basins",
    group: "environmental",
    sourceId: "environmental-hydro-basins",
    sourceType: "vector",
    zoomMin: 5,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "environmental.water-features": {
    id: "environmental.water-features",
    group: "environmental",
    sourceId: "environmental.water-features.source",
    sourceType: "raster",
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
    zoomMin: 0,
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
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: true,
    dependencies: [],
    budgetWeight: 2,
  },
  "facilities.hyperscale-leased": {
    id: "facilities.hyperscale-leased",
    group: "facilities",
    sourceId: "facilities.hyperscale-leased",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "facilities.enterprise": {
    id: "facilities.enterprise",
    group: "facilities",
    sourceId: "facilities.enterprise",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "markets.market": {
    id: "markets.market",
    group: "markets",
    sourceId: "markets.market.source",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "markets.submarket": {
    id: "markets.submarket",
    group: "markets",
    sourceId: "markets.submarket.source",
    sourceType: "geojson",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "models.county-power-grid-stress": {
    id: "models.county-power-grid-stress",
    group: "models",
    sourceId: "county-power-story.source",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "models.county-power-queue-pressure": {
    id: "models.county-power-queue-pressure",
    group: "models",
    sourceId: "county-power-story.source",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "models.county-power-market-structure": {
    id: "models.county-power-market-structure",
    group: "models",
    sourceId: "county-power-story.source",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "models.county-power-policy-watch": {
    id: "models.county-power-policy-watch",
    group: "models",
    sourceId: "county-power-story.source",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 1,
  },
  "models.county-power-3d": {
    id: "models.county-power-3d",
    group: "models",
    sourceId: "county-power-story.source",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 3,
  },
  "infrastructure.gas-pipelines": {
    id: "infrastructure.gas-pipelines",
    group: "infrastructure",
    sourceId: "gas-pipelines",
    sourceType: "vector",
    zoomMin: 0,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 2,
  },
  "power.transmission": {
    id: "power.transmission",
    group: "infrastructure",
    sourceId: "power.infrastructure",
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
    sourceId: "power.infrastructure",
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
    sourceId: "power.infrastructure",
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
    defaultVisible: false,
    dependencies: [],
    budgetWeight: 5,
  },
};

export function isLayerId(value: string): value is LayerId {
  return layerIdLookup.has(value);
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
