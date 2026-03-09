import type {
  FillLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
} from "maplibre-gl";

const FLOOD_100_COLOR = "#2aa7d6";
const FLOOD_100_OUTLINE_COLOR = "#1f6f8f";
const FLOOD_500_COLOR = "#e6a23a";
const FLOOD_500_OUTLINE_COLOR = "#9b6b24";

export function flood100FillFilter(): FilterSpecification {
  return ["==", ["get", "is_flood_100"], 1];
}

export function flood500FillFilter(): FilterSpecification {
  return ["==", ["get", "is_flood_500"], 1];
}

export function flood100FillPaint(): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": FLOOD_100_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.24, 11, 0.22, 13, 0.26, 18, 0.26],
  };
}

export function flood500FillPaint(): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": FLOOD_500_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.15, 11, 0.12, 13, 0.15, 18, 0.15],
  };
}

export function flood100OutlinePaint(): NonNullable<LineLayerSpecification["paint"]> {
  return {
    "line-color": FLOOD_100_OUTLINE_COLOR,
    "line-opacity": 0.92,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1.1,
      6,
      1.1,
      11,
      0.95,
      12,
      1.25,
      14,
      1.75,
      18,
      1.75,
    ],
  };
}

export function flood500OutlinePaint(): NonNullable<LineLayerSpecification["paint"]> {
  return {
    "line-color": FLOOD_500_OUTLINE_COLOR,
    "line-opacity": 0.82,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      0.95,
      6,
      0.95,
      11,
      0.8,
      12,
      1,
      14,
      1.3,
      18,
      1.3,
    ],
  };
}
