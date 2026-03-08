import type {
  FillLayerSpecification,
  FilterSpecification,
  LineLayerSpecification,
} from "maplibre-gl";

const FLOOD_100_COLOR = "#2aa7d6";
const FLOOD_100_OUTLINE_COLOR = "#1f6f8f";
const FLOOD_500_COLOR = "#e6a23a";

export function flood100FillFilter(): FilterSpecification {
  return ["==", ["get", "is_flood_100"], 1];
}

export function flood500FillFilter(): FilterSpecification {
  return ["==", ["get", "is_flood_500"], 1];
}

export function flood100FillPaint(): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": FLOOD_100_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.22, 12, 0.22, 13, 0.26, 18, 0.26],
  };
}

export function flood500FillPaint(): NonNullable<FillLayerSpecification["paint"]> {
  return {
    "fill-color": FLOOD_500_COLOR,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.12, 12, 0.12, 13, 0.15, 18, 0.15],
  };
}

export function flood100OutlinePaint(): NonNullable<LineLayerSpecification["paint"]> {
  return {
    "line-color": FLOOD_100_OUTLINE_COLOR,
    "line-opacity": 0.92,
    "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.75, 12, 1.25, 14, 1.75, 18, 1.75],
  };
}
