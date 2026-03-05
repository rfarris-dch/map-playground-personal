import type { LngLat } from "@map-migration/map-engine";

export interface MeasureSourceData {
  features: MeasureFeature[];
  type: "FeatureCollection";
}

export interface MeasureFeature {
  geometry: MeasureGeometry;
  properties: {
    kind: "area" | "line" | "vertex";
    vertexIndex?: number;
  };
  type: "Feature";
}

export type MeasureGeometry =
  | {
      type: "LineString";
      coordinates: LngLat[];
    }
  | {
      type: "Point";
      coordinates: LngLat;
    }
  | {
      type: "Polygon";
      coordinates: LngLat[][];
    };
