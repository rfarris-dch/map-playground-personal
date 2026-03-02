export type LayerGroup =
  | "basemap"
  | "admin"
  | "facilities"
  | "infrastructure"
  | "environmental"
  | "parcels"
  | "models";

export interface LayerDefinition {
  budgetWeight: number;
  defaultVisible: boolean;
  dependencies: string[];
  group: LayerGroup;
  id: string;
  sourceId: string;
  sourceType: "vector" | "raster" | "geojson" | "custom";
  zoomMax: number;
  zoomMin: number;
}

export type LayerCatalog = Record<string, LayerDefinition>;

export const DEFAULT_LAYER_CATALOG: LayerCatalog = {
  "admin.county": {
    id: "admin.county",
    group: "admin",
    sourceId: "admin-county",
    sourceType: "geojson",
    zoomMin: 3,
    zoomMax: 22,
    defaultVisible: true,
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
    dependencies: ["admin.county"],
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
    dependencies: ["admin.county"],
    budgetWeight: 2,
  },
  "property.parcels": {
    id: "property.parcels",
    group: "parcels",
    sourceId: "parcels",
    sourceType: "vector",
    zoomMin: 13,
    zoomMax: 22,
    defaultVisible: false,
    dependencies: ["admin.county"],
    budgetWeight: 5,
  },
};

export function validateLayerCatalog(catalog: LayerCatalog): string[] {
  const errors: string[] = [];

  for (const [id, layer] of Object.entries(catalog)) {
    if (id !== layer.id) {
      errors.push(`Layer key mismatch: key=${id} layer.id=${layer.id}`);
    }
    if (layer.zoomMin > layer.zoomMax) {
      errors.push(`Invalid zoom range for ${id}: ${layer.zoomMin} > ${layer.zoomMax}`);
    }
    for (const dep of layer.dependencies) {
      if (!catalog[dep]) {
        errors.push(`Unknown dependency for ${id}: ${dep}`);
      }
    }
  }

  return errors;
}

export function visibleLayerCount(catalog: LayerCatalog): number {
  return Object.values(catalog).filter((layer) => layer.defaultVisible).length;
}
