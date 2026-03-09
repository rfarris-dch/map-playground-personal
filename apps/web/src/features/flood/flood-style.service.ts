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
    "line-opacity": 0.96,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      2.2,
      6,
      2.2,
      11,
      1.2,
      12,
      1.5,
      14,
      1.9,
      18,
      1.9,
    ],
  };
}

export function flood500OutlinePaint(): NonNullable<LineLayerSpecification["paint"]> {
  return {
    "line-color": FLOOD_500_OUTLINE_COLOR,
    "line-opacity": 0.9,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0,
      1.8,
      6,
      1.8,
      11,
      1,
      12,
      1.2,
      14,
      1.5,
      18,
      1.5,
    ],
  };
}
