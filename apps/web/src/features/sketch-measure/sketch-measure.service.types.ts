import type { LngLat } from "@map-migration/map-engine";

export interface SketchMeasureSourceData {
  features: SketchMeasureFeature[];
  type: "FeatureCollection";
}

export interface SketchMeasureFeature {
  geometry: SketchMeasureGeometry;
  properties: {
    kind: "area" | "line" | "vertex";
    vertexIndex?: number;
  };
  type: "Feature";
}

export type SketchMeasureGeometry =
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
