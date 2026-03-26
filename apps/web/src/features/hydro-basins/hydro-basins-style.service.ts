import type {
  FillLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";

interface HydroBasinsZoomBand {
  readonly maxZoom: number;
  readonly minZoom: number;
}

const HYDRO_ZOOM_BANDS: Readonly<
  Record<"huc10" | "huc12" | "huc4" | "huc6" | "huc8", HydroBasinsZoomBand>
> = {
  huc4: {
    minZoom: 5,
    maxZoom: 6,
  },
  huc6: {
    minZoom: 6,
    maxZoom: 8,
  },
  huc8: {
    minZoom: 8,
    maxZoom: 9.5,
  },
  huc10: {
    minZoom: 9.5,
    maxZoom: 10.5,
  },
  huc12: {
    minZoom: 10.5,
    maxZoom: 22,
  },
};

function hydroBasinsZoomBand(level: keyof typeof HYDRO_ZOOM_BANDS): HydroBasinsZoomBand {
  return HYDRO_ZOOM_BANDS[level];
}

export function hydroBasinsLinePaint(
  level: "huc10" | "huc12" | "huc4" | "huc6" | "huc8"
): NonNullable<LineLayerSpecification["paint"]> {
  const lineStyles: Readonly<
    Record<
      "huc10" | "huc12" | "huc4" | "huc6" | "huc8",
      {
        readonly color: string;
        readonly opacity: number;
        readonly width: readonly [number, number];
      }
    >
  > = {
    huc4: { color: "#1f5f8b", opacity: 0.9, width: [2, 3] },
    huc6: { color: "#2f739d", opacity: 0.86, width: [1.7, 2.5] },
    huc8: { color: "#3f88af", opacity: 0.82, width: [1.45, 2.05] },
    huc10: { color: "#4f9dc0", opacity: 0.8, width: [1.2, 1.8] },
    huc12: { color: "#66afd0", opacity: 0.74, width: [1.05, 1.45] },
  };

  const lineStyle = lineStyles[level];
  const zoomBand = hydroBasinsZoomBand(level);
  return {
    "line-color": lineStyle.color,
    "line-opacity": lineStyle.opacity,
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      zoomBand.minZoom,
      lineStyle.width[0],
      zoomBand.maxZoom,
      lineStyle.width[1],
    ],
  };
}

export function hydroBasinsFillPaint(
  level: "huc10" | "huc12" | "huc4" | "huc6" | "huc8"
): NonNullable<FillLayerSpecification["paint"]> {
  const fillStyles: Readonly<
    Record<
      "huc10" | "huc12" | "huc4" | "huc6" | "huc8",
      {
        readonly opacity: readonly [number, number];
      }
    >
  > = {
    huc4: { opacity: [0.58, 0.48] },
    huc6: { opacity: [0.52, 0.42] },
    huc8: { opacity: [0.44, 0.34] },
    huc10: { opacity: [0.34, 0.24] },
    huc12: { opacity: [0.22, 0.16] },
  };

  const fillStyle = fillStyles[level];
  const zoomBand = hydroBasinsZoomBand(level);
  return {
    "fill-color": [
      "match",
      ["%", ["to-number", ["coalesce", ["get", "huc"], "0"]], 8],
      0,
      "#f7ec9d",
      1,
      "#f5b1d5",
      2,
      "#b9d0ff",
      3,
      "#f5c57b",
      4,
      "#bea7ea",
      5,
      "#99e3c2",
      6,
      "#f3a8a0",
      "#9fd36f",
    ],
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      zoomBand.minZoom,
      fillStyle.opacity[0],
      zoomBand.maxZoom,
      fillStyle.opacity[1],
    ],
  };
}

export function hydroBasinsLabelLayout(
  level: "huc10" | "huc4" | "huc6" | "huc8"
): NonNullable<SymbolLayerSpecification["layout"]> {
  const textSize = {
    huc4: 12,
    huc6: 11,
    huc8: 10,
    huc10: 9,
  };

  return {
    "symbol-placement": "point",
    "text-field": ["coalesce", ["get", "name"], ["get", "huc"]],
    "text-font": ["Noto Sans Regular"],
    "text-size": textSize[level],
    "text-allow-overlap": false,
    "text-padding": 3,
  };
}

export function hydroBasinsLabelPaint(): NonNullable<SymbolLayerSpecification["paint"]> {
  return {
    "text-color": "#23445d",
    "text-halo-color": "#ffffff",
    "text-halo-width": 2,
  };
}
