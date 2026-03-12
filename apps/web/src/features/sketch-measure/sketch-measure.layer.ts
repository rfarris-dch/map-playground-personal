import type { IMap, MapClickEvent, MapPointerEvent } from "@map-migration/map-engine";
import {
  buildSketchMeasureSourceData,
  buildSketchMeasureState,
  emptySketchMeasureSourceData,
} from "@/features/sketch-measure/sketch-measure.service";
import type {
  SketchMeasureAreaShape,
  SketchMeasureLayerController,
  SketchMeasureLayerOptions,
  SketchMeasureMode,
  SketchMeasureRuntimeState,
} from "@/features/sketch-measure/sketch-measure.types";

const FREEFORM_CLOSE_HITBOX_PX = 10;

function initialRuntimeState(): SketchMeasureRuntimeState {
  return {
    ready: false,
    mode: "off",
    vertices: [],
    cursorVertex: null,
    areaShape: "freeform",
    areaComplete: false,
  };
}

function eventVertex(event: MapClickEvent | MapPointerEvent): [number, number] {
  return [event.lngLat.lng, event.lngLat.lat];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function featureVertexIndex(feature: unknown): number | null {
  if (!isRecord(feature)) {
    return null;
  }

  const properties = Reflect.get(feature, "properties");
  if (!isRecord(properties)) {
    return null;
  }

  const vertexIndex = Reflect.get(properties, "vertexIndex");
  if (typeof vertexIndex !== "number" || !Number.isFinite(vertexIndex)) {
    return null;
  }

  return Math.floor(vertexIndex);
}

function shouldCloseFreeformArea(
  map: IMap,
  vertexLayerId: string,
  event: MapClickEvent,
  vertices: readonly [number, number][]
): boolean {
  if (vertices.length < 3) {
    return false;
  }

  const [x, y] = event.point;
  const paddedTarget: [[number, number], [number, number]] = [
    [x - FREEFORM_CLOSE_HITBOX_PX, y - FREEFORM_CLOSE_HITBOX_PX],
    [x + FREEFORM_CLOSE_HITBOX_PX, y + FREEFORM_CLOSE_HITBOX_PX],
  ];

  return map
    .queryRenderedFeatures(paddedTarget, {
      layers: [vertexLayerId],
    })
    .some((feature) => featureVertexIndex(feature) === 0);
}

export function mountSketchMeasureLayer(
  map: IMap,
  options: SketchMeasureLayerOptions = {}
): SketchMeasureLayerController {
  const sourceId = "sketch-measure.overlay";
  const lineLayerId = "sketch-measure.overlay.line";
  const vertexLayerId = "sketch-measure.overlay.vertices";

  const state = initialRuntimeState();

  const emitState = (): void => {
    options.onStateChange?.(buildSketchMeasureState(state));
  };

  const ensureReady = (): void => {
    if (!map.hasSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: emptySketchMeasureSourceData(),
      });
    }

    if (!map.hasLayer(lineLayerId)) {
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
    }

    if (!map.hasLayer(vertexLayerId)) {
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
    }

    state.ready = true;
  };

  const syncSource = (): void => {
    ensureReady();

    map.setGeoJSONSourceData(sourceId, buildSketchMeasureSourceData(state));
    emitState();
  };

  const clear = (): void => {
    state.vertices = [];
    state.cursorVertex = null;
    state.areaComplete = false;
    syncSource();
  };

  const setMode = (mode: SketchMeasureMode): void => {
    if (state.mode === mode) {
      return;
    }

    state.mode = mode;
    clear();
  };

  const setAreaShape = (shape: SketchMeasureAreaShape): void => {
    if (state.areaShape === shape) {
      return;
    }

    state.areaShape = shape;
    clear();
  };

  const finishArea = (): void => {
    if (!state.ready || state.mode !== "area" || state.areaComplete) {
      return;
    }

    if (state.areaShape === "freeform") {
      if (state.vertices.length < 3) {
        return;
      }

      state.areaComplete = true;
      state.cursorVertex = null;
      syncSource();
      return;
    }

    if (state.vertices.length === 1 && state.cursorVertex !== null) {
      const anchor = state.vertices[0];
      if (anchor) {
        state.vertices = [anchor, [state.cursorVertex[0], state.cursorVertex[1]]];
      }
    }

    if (state.vertices.length < 2) {
      return;
    }

    state.areaComplete = true;
    state.cursorVertex = null;
    syncSource();
  };

  const onLoad = (): void => {
    ensureReady();
    syncSource();
  };

  const onDistanceClick = (clickedVertex: [number, number]): void => {
    state.vertices.push(clickedVertex);
    syncSource();
  };

  const onFreeformAreaClick = (event: MapClickEvent, clickedVertex: [number, number]): void => {
    if (state.areaComplete) {
      return;
    }

    if (shouldCloseFreeformArea(map, vertexLayerId, event, state.vertices)) {
      state.areaComplete = true;
      state.cursorVertex = null;
      syncSource();
      return;
    }

    state.vertices.push(clickedVertex);
    syncSource();
  };

  const onBoxAreaClick = (clickedVertex: [number, number]): void => {
    if (state.areaComplete || state.vertices.length >= 2) {
      return;
    }

    if (state.vertices.length === 0) {
      state.vertices.push(clickedVertex);
      state.cursorVertex = clickedVertex;
      syncSource();
      return;
    }

    const anchor = state.vertices[0];
    if (!anchor) {
      state.vertices = [clickedVertex];
      state.cursorVertex = clickedVertex;
      syncSource();
      return;
    }

    state.vertices = [anchor, clickedVertex];
    state.areaComplete = true;
    state.cursorVertex = null;
    syncSource();
  };

  const onClick = (event: MapClickEvent): void => {
    if (!state.ready || state.mode === "off") {
      return;
    }

    const clickedVertex = eventVertex(event);

    if (state.mode === "distance") {
      onDistanceClick(clickedVertex);
      return;
    }

    if (state.areaShape === "freeform") {
      onFreeformAreaClick(event, clickedVertex);
      return;
    }

    onBoxAreaClick(clickedVertex);
  };

  const onPointerMove = (event: MapPointerEvent): void => {
    if (!state.ready || state.mode === "off") {
      return;
    }

    if (state.mode === "area" && state.areaComplete) {
      return;
    }

    state.cursorVertex = eventVertex(event);
    syncSource();
  };

  const onPointerLeave = (): void => {
    if (!state.ready || state.mode === "off") {
      return;
    }

    if (state.mode === "area" && state.areaComplete) {
      return;
    }

    if (state.cursorVertex === null) {
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
    finishArea,
    setAreaShape,
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
