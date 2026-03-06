import maplibregl, {
  type AddProtocolAction,
  addProtocol,
  type FullscreenControlOptions as MapLibreFullscreenControlOptions,
  type Map as MapLibreMap,
  type NavigationControlOptions as MapLibreNavigationControlOptions,
  type ScaleControlOptions as MapLibreScaleControlOptions,
  type MapMouseEvent,
  type MapOptions,
  removeProtocol,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import type {
  FeatureStateTarget,
  FullscreenControlOptions,
  IMap,
  LngLat,
  LngLatBounds,
  MapAdapter,
  MapClickEvent,
  MapControl,
  MapControlPosition,
  MapCreateOptions,
  MapLayerSpecification,
  MapPointerEvent,
  MapPointLike,
  MapProjectionSpecification,
  MapQueryRenderedFeaturesOptions,
  MapRenderedFeature,
  MapSourceSpecification,
  MapStyleSpecification,
  MapTerrainSpecification,
  NavigationControlOptions,
  PmtilesProtocolRuntime,
  ScaleControlOptions,
  StyleInput,
} from "./index.types";

export type {
  FeatureStateTarget,
  FullscreenControlOptions,
  IMap,
  LngLat,
  LngLatBounds,
  MapAdapter,
  MapClickEvent,
  MapControl,
  MapControlPosition,
  MapCreateOptions,
  MapExpression,
  MapLayerSpecification,
  MapPointerEvent,
  MapPointLike,
  MapProjectionSpecification,
  MapQueryRenderedFeaturesOptions,
  MapRenderedFeature,
  MapRequestParameters,
  MapRequestTransformFunction,
  MapResourceType,
  MapSourceSpecification,
  MapStyleLayer,
  MapStyleSpecification,
  MapTerrainSpecification,
  NavigationControlOptions,
  ScaleControlOptions,
  StyleInput,
} from "./index.types";

function isSourceWithSetData(source: unknown): source is { setData: (data: unknown) => void } {
  if (typeof source !== "object" || source === null) {
    return false;
  }

  return typeof Reflect.get(source, "setData") === "function";
}

function isStyleNotDoneLoadingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("Style is not done loading.");
}

class MapLibreEngine implements IMap {
  private readonly clickHandlers: Map<
    (event: MapClickEvent) => void,
    (event: MapMouseEvent) => void
  >;
  private preferredProjection: MapProjectionSpecification | null;
  private projectionLoadHandler: (() => void) | null;
  private readonly pointerLeaveHandlers: Map<() => void, () => void>;
  private readonly pointerMoveHandlers: Map<
    (event: MapPointerEvent) => void,
    (event: MapMouseEvent) => void
  >;
  private readonly map: MapLibreMap;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.clickHandlers = new Map();
    this.pointerMoveHandlers = new Map();
    this.pointerLeaveHandlers = new Map();
    this.preferredProjection = null;
    this.projectionLoadHandler = null;
  }

  addControl(control: MapControl, position?: MapControlPosition): void {
    this.map.addControl(control, position);
  }

  addSource(id: string, spec: MapSourceSpecification): void {
    this.map.addSource(id, spec);
  }

  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void {
    this.map.addLayer(layerSpec, beforeId);
  }

  hasSource(sourceId: string): boolean {
    return typeof this.map.getSource(sourceId) !== "undefined";
  }

  hasLayer(layerId: string): boolean {
    return typeof this.map.getLayer(layerId) !== "undefined";
  }

  removeControl(control: MapControl): void {
    this.map.removeControl(control);
  }

  removeLayer(layerId: string): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.removeLayer(layerId);
  }

  removeSource(sourceId: string): void {
    if (!this.hasSource(sourceId)) {
      return;
    }

    this.map.removeSource(sourceId);
  }

  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>): void {
    this.map.setFeatureState(target, state);
  }

  queryRenderedFeatures(
    target: MapPointLike | [MapPointLike, MapPointLike],
    options?: MapQueryRenderedFeaturesOptions
  ): MapRenderedFeature[] {
    return this.map.queryRenderedFeatures(target, options);
  }

  project(lngLat: LngLat): [number, number] {
    const point = this.map.project({
      lng: lngLat[0],
      lat: lngLat[1],
    });
    return [point.x, point.y];
  }

  getCanvasSize(): { readonly height: number; readonly width: number } {
    const container = this.map.getContainer();
    return {
      width: container.clientWidth,
      height: container.clientHeight,
    };
  }

  getBounds(): LngLatBounds {
    const bounds = this.map.getBounds();
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  }

  getZoom(): number {
    return this.map.getZoom();
  }

  getStyle(): MapStyleSpecification {
    return this.map.getStyle();
  }

  setStyle(style: StyleInput): void {
    this.map.setStyle(style);
    this.scheduleProjectionApplication();
  }

  setProjection(projection: MapProjectionSpecification): void {
    this.preferredProjection = projection;
    this.scheduleProjectionApplication();
  }

  setTerrain(terrain: MapTerrainSpecification | null): void {
    this.map.setTerrain(terrain);
  }

  setGeoJSONSourceData(sourceId: string, data: unknown): void {
    const source = this.map.getSource(sourceId);
    if (!isSourceWithSetData(source)) {
      throw new Error(`[map-engine] Source "${sourceId}" does not support setData().`);
    }

    source.setData(data);
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }

  on(event: "load" | "moveend", handler: () => void): void {
    if (event === "load" && this.map.isStyleLoaded()) {
      queueMicrotask(handler);
      return;
    }

    this.map.on(event, handler);
  }

  off(event: "load" | "moveend", handler: () => void): void {
    this.map.off(event, handler);
  }

  onClick(handler: (event: MapClickEvent) => void): void {
    if (this.clickHandlers.has(handler)) {
      return;
    }

    const wrappedHandler = (event: MapMouseEvent): void => {
      handler(this.toPointerEvent(event));
    };

    this.clickHandlers.set(handler, wrappedHandler);
    this.map.on("click", wrappedHandler);
  }

  offClick(handler: (event: MapClickEvent) => void): void {
    const wrappedHandler = this.clickHandlers.get(handler);
    if (!wrappedHandler) {
      return;
    }

    this.map.off("click", wrappedHandler);
    this.clickHandlers.delete(handler);
  }

  onPointerMove(handler: (event: MapPointerEvent) => void): void {
    if (this.pointerMoveHandlers.has(handler)) {
      return;
    }

    const wrappedHandler = (event: MapMouseEvent): void => {
      handler(this.toPointerEvent(event));
    };

    this.pointerMoveHandlers.set(handler, wrappedHandler);
    this.map.on("mousemove", wrappedHandler);
  }

  offPointerMove(handler: (event: MapPointerEvent) => void): void {
    const wrappedHandler = this.pointerMoveHandlers.get(handler);
    if (!wrappedHandler) {
      return;
    }

    this.map.off("mousemove", wrappedHandler);
    this.pointerMoveHandlers.delete(handler);
  }

  onPointerLeave(handler: () => void): void {
    if (this.pointerLeaveHandlers.has(handler)) {
      return;
    }

    const wrappedHandler = (): void => {
      handler();
    };

    this.pointerLeaveHandlers.set(handler, wrappedHandler);
    this.map.on("mouseout", wrappedHandler);
  }

  offPointerLeave(handler: () => void): void {
    const wrappedHandler = this.pointerLeaveHandlers.get(handler);
    if (!wrappedHandler) {
      return;
    }

    this.map.off("mouseout", wrappedHandler);
    this.pointerLeaveHandlers.delete(handler);
  }

  private toPointerEvent(event: MapMouseEvent): MapPointerEvent {
    return {
      lngLat: {
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      },
      point: [event.point.x, event.point.y],
    };
  }

  destroy(): void {
    this.stopProjectionListeners();
    this.clickHandlers.clear();
    this.pointerMoveHandlers.clear();
    this.pointerLeaveHandlers.clear();
    this.map.remove();
  }

  private stopProjectionListeners(): void {
    if (this.projectionLoadHandler === null) {
      return;
    }

    this.map.off("load", this.projectionLoadHandler);
    this.map.off("styledata", this.projectionLoadHandler);
    this.projectionLoadHandler = null;
  }

  private scheduleProjectionApplication(): void {
    if (this.preferredProjection === null) {
      return;
    }

    const applyProjection = (): void => {
      const projection = this.preferredProjection;
      if (projection === null) {
        this.stopProjectionListeners();
        return;
      }

      try {
        this.map.setProjection(projection);
        this.stopProjectionListeners();
      } catch (error: unknown) {
        if (isStyleNotDoneLoadingError(error)) {
          return;
        }

        this.stopProjectionListeners();
        console.error("[map-engine] Failed to apply map projection.", error);
      }
    };

    this.stopProjectionListeners();
    this.projectionLoadHandler = applyProjection;
    this.map.on("load", applyProjection);
    this.map.on("styledata", applyProjection);
    queueMicrotask(applyProjection);
  }
}

let pmtilesProtocolRuntime: PmtilesProtocolRuntime | null = null;

function createPmtilesLoadAction(protocol: Protocol): AddProtocolAction {
  return protocol.tile.bind(protocol);
}

export function registerPmtilesProtocol(): () => void {
  if (pmtilesProtocolRuntime === null) {
    const protocol = new Protocol();
    addProtocol("pmtiles", createPmtilesLoadAction(protocol));
    pmtilesProtocolRuntime = {
      protocol,
      refCount: 1,
    };
  } else {
    pmtilesProtocolRuntime.refCount += 1;
  }

  let disposed = false;
  return (): void => {
    if (disposed) {
      return;
    }
    disposed = true;

    const runtime = pmtilesProtocolRuntime;
    if (runtime === null) {
      return;
    }

    runtime.refCount -= 1;
    if (runtime.refCount > 0) {
      return;
    }

    removeProtocol("pmtiles");
    pmtilesProtocolRuntime = null;
  };
}

export function createMap(
  adapter: MapAdapter,
  container: HTMLElement,
  options: MapCreateOptions
): IMap {
  return adapter.createMap(container, options);
}

export function createMapLibreAdapter(): MapAdapter {
  return {
    createMap(container: HTMLElement, options: MapCreateOptions): IMap {
      const { center, zoom, minZoom, maxZoom, projection, style, hash, transformRequest } = options;
      const mapOptions: MapOptions = {
        container,
        center,
        zoom,
        style,
      };
      if (typeof minZoom === "number") {
        mapOptions.minZoom = minZoom;
      }
      if (typeof maxZoom === "number") {
        mapOptions.maxZoom = maxZoom;
      }
      if (typeof hash !== "undefined") {
        mapOptions.hash = hash;
      }
      if (typeof transformRequest === "function") {
        mapOptions.transformRequest = transformRequest;
      }

      const map = new maplibregl.Map(mapOptions);
      const engine = new MapLibreEngine(map);
      if (typeof projection !== "undefined") {
        engine.setProjection(projection);
      }

      return engine;
    },
  };
}

export function isZoomInRange(zoom: number, min?: number, max?: number): boolean {
  if (typeof min === "number" && zoom < min) {
    return false;
  }
  if (typeof max === "number" && zoom > max) {
    return false;
  }
  return true;
}

function toNavigationControlOptions(
  options: NavigationControlOptions
): MapLibreNavigationControlOptions {
  const mapped: MapLibreNavigationControlOptions = {};
  if (typeof options.showCompass === "boolean") {
    mapped.showCompass = options.showCompass;
  }
  if (typeof options.showZoom === "boolean") {
    mapped.showZoom = options.showZoom;
  }
  if (typeof options.visualizePitch === "boolean") {
    mapped.visualizePitch = options.visualizePitch;
  }
  return mapped;
}

function toScaleControlOptions(options: ScaleControlOptions): MapLibreScaleControlOptions {
  const mapped: MapLibreScaleControlOptions = {};
  if (typeof options.maxWidth === "number" && Number.isFinite(options.maxWidth)) {
    mapped.maxWidth = options.maxWidth;
  }
  if (typeof options.unit === "string") {
    mapped.unit = options.unit;
  }
  return mapped;
}

function toFullscreenControlOptions(
  options: FullscreenControlOptions
): MapLibreFullscreenControlOptions {
  const mapped: MapLibreFullscreenControlOptions = {};
  if (options.container instanceof HTMLElement) {
    mapped.container = options.container;
  }
  return mapped;
}

export function createNavigationControl(options: NavigationControlOptions = {}): MapControl {
  return new maplibregl.NavigationControl(toNavigationControlOptions(options));
}

export function createScaleControl(options: ScaleControlOptions = {}): MapControl {
  return new maplibregl.ScaleControl(toScaleControlOptions(options));
}

export function createFullscreenControl(options: FullscreenControlOptions = {}): MapControl {
  return new maplibregl.FullscreenControl(toFullscreenControlOptions(options));
}
