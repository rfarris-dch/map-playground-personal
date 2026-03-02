import type { IMap, MapClickEvent, MapPointerEvent } from "@map-migration/map-engine";
import {
  buildMeasureSourceData,
  buildMeasureState,
  emptyMeasureSourceData,
} from "./measure.service";
import type {
  MeasureLayerController,
  MeasureLayerOptions,
  MeasureMode,
  MeasureRuntimeState,
} from "./measure.types";

function initialRuntimeState(): MeasureRuntimeState {
  return {
    ready: false,
    mode: "off",
    vertices: [],
    cursorVertex: null,
  };
}

export function mountMeasureLayer(
  map: IMap,
  options: MeasureLayerOptions = {}
): MeasureLayerController {
  const sourceId = "measure.overlay";
  const polygonLayerId = "measure.overlay.area";
  const lineLayerId = "measure.overlay.line";
  const vertexLayerId = "measure.overlay.vertices";

  const state = initialRuntimeState();

  const emitState = (): void => {
    options.onStateChange?.(buildMeasureState(state));
  };

  const syncSource = (): void => {
    if (!state.ready) {
      return;
    }

    map.setGeoJSONSourceData(sourceId, buildMeasureSourceData(state));
    emitState();
  };

  const clear = (): void => {
    state.vertices = [];
    state.cursorVertex = null;
    syncSource();
  };

  const setMode = (mode: MeasureMode): void => {
    if (state.mode === mode) {
      return;
    }

    state.mode = mode;
    clear();
  };

  const onLoad = (): void => {
    state.ready = true;

    map.addSource(sourceId, {
      type: "geojson",
      data: emptyMeasureSourceData(),
    });

    map.addLayer({
      id: polygonLayerId,
      type: "fill",
      source: sourceId,
      filter: ["==", ["get", "kind"], "area"],
      paint: {
        "fill-color": "#0891b2",
        "fill-opacity": 0.14,
      },
    });

    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      filter: ["==", ["get", "kind"], "line"],
      paint: {
        "line-color": "#0e7490",
        "line-width": 2.25,
        "line-dasharray": [2, 1],
      },
    });

    map.addLayer({
      id: vertexLayerId,
      type: "circle",
      source: sourceId,
      filter: ["==", ["get", "kind"], "vertex"],
      paint: {
        "circle-color": "#0f766e",
        "circle-radius": 4,
        "circle-stroke-color": "#ecfeff",
        "circle-stroke-width": 1.5,
      },
    });

    syncSource();
  };

  const onClick = (event: MapClickEvent): void => {
    if (!state.ready || state.mode === "off") {
      return;
    }

    state.vertices.push([event.lngLat.lng, event.lngLat.lat]);
    syncSource();
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!state.ready || state.mode === "off") {
      return;
    }

    state.cursorVertex = [event.lngLat.lng, event.lngLat.lat];
    syncSource();
  };

  const onPointerLeave = (): void => {
    if (!state.ready || state.mode === "off" || state.cursorVertex === null) {
      return;
    }

    state.cursorVertex = null;
    syncSource();
  };

  map.on("load", onLoad);
  map.onClick(onClick);
  map.onPointerMove(onPointerMove);
  map.onPointerLeave(onPointerLeave);

  emitState();

  return {
    clear,
    setMode,
    destroy(): void {
      clear();
      map.off("load", onLoad);
      map.offClick(onClick);
      map.offPointerMove(onPointerMove);
      map.offPointerLeave(onPointerLeave);
    },
  };
}
