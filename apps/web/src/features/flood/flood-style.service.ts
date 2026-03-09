import type { FillLayerSpecification, FilterSpecification } from "maplibre-gl";

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
    "fill-outline-color": FLOOD_100_OUTLINE_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.24, 11, 0.22, 13, 0.26, 18, 0.26],
  };
}

export function flood500FillPaint(): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": FLOOD_500_COLOR,
    "fill-outline-color": FLOOD_500_OUTLINE_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.15, 11, 0.12, 13, 0.15, 18, 0.15],
  };
}
