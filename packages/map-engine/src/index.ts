import maplibregl, {
  type AddLayerObject,
  type AddProtocolAction,
  addProtocol,
  type ControlPosition,
  type IControl,
  type MapGeoJSONFeature,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type MapOptions,
  type PointLike,
  type ProjectionSpecification,
  type QueryRenderedFeaturesOptions,
  removeProtocol,
  type SourceSpecification,
  type StyleSpecification,
  type TerrainSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";

export type LngLat = [number, number];
export type StyleInput = StyleSpecification | string;

export interface LngLatBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

export interface MapCreateOptions {
  center: LngLat;
  hash?: boolean;
  maxZoom?: number;
  minZoom?: number;
  style: StyleInput;
  zoom: number;
}

export interface FeatureStateTarget {
  id: string | number;
  source: string;
  sourceLayer?: string;
}

export interface MapClickEvent {
  lngLat: {
    lat: number;
    lng: number;
  };
  point: [number, number];
}

export interface MapPointerEvent {
  lngLat: {
    lat: number;
    lng: number;
  };
  point: [number, number];
}

export interface IMap {
  addControl(control: IControl, position?: ControlPosition): void;
  addLayer(layerSpec: AddLayerObject, beforeId?: string): void;
  addSource(id: string, spec: SourceSpecification): void;
  destroy(): void;
  getBounds(): LngLatBounds;
  getStyle(): StyleSpecification;
  getZoom(): number;
  hasLayer(layerId: string): boolean;
  hasSource(sourceId: string): boolean;
  off(event: "load" | "moveend", handler: () => void): void;
  offClick(handler: (event: MapClickEvent) => void): void;
  offPointerLeave(handler: () => void): void;
  offPointerMove(handler: (event: MapPointerEvent) => void): void;
  on(event: "load" | "moveend", handler: () => void): void;
  onClick(handler: (event: MapClickEvent) => void): void;
  onPointerLeave(handler: () => void): void;
  onPointerMove(handler: (event: MapPointerEvent) => void): void;
  queryRenderedFeatures(
    target: PointLike | [PointLike, PointLike],
    options?: QueryRenderedFeaturesOptions
  ): MapGeoJSONFeature[];
  removeControl(control: IControl): void;
  removeLayer(layerId: string): void;
  removeSource(sourceId: string): void;
  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>): void;
  setGeoJSONSourceData(sourceId: string, data: unknown): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  setProjection(projection: ProjectionSpecification): void;
  setStyle(style: StyleInput): void;
  setTerrain(terrain: TerrainSpecification | null): void;
}

function isSourceWithSetData(source: unknown): source is { setData: (data: unknown) => void } {
  if (typeof source !== "object" || source === null) {
    return false;
  }

  return typeof Reflect.get(source, "setData") === "function";
}

class MapLibreEngine implements IMap {
  private readonly clickHandlers: Map<
    (event: MapClickEvent) => void,
    (event: MapMouseEvent) => void
  >;
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
  }

  addControl(control: IControl, position?: ControlPosition): void {
    this.map.addControl(control, position);
  }

  addSource(id: string, spec: SourceSpecification): void {
    this.map.addSource(id, spec);
  }

  addLayer(layerSpec: AddLayerObject, beforeId?: string): void {
    this.map.addLayer(layerSpec, beforeId);
  }

  hasSource(sourceId: string): boolean {
    return typeof this.map.getSource(sourceId) !== "undefined";
  }

  hasLayer(layerId: string): boolean {
    return typeof this.map.getLayer(layerId) !== "undefined";
  }

  removeControl(control: IControl): void {
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
    target: PointLike | [PointLike, PointLike],
    options?: QueryRenderedFeaturesOptions
  ): MapGeoJSONFeature[] {
    return this.map.queryRenderedFeatures(target, options);
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

  getStyle(): StyleSpecification {
    return this.map.getStyle();
  }

  setStyle(style: StyleInput): void {
    this.map.setStyle(style);
  }

  setProjection(projection: ProjectionSpecification): void {
    this.map.setProjection(projection);
  }

  setTerrain(terrain: TerrainSpecification | null): void {
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
    this.clickHandlers.clear();
    this.pointerMoveHandlers.clear();
    this.pointerLeaveHandlers.clear();
    this.map.remove();
  }
}

export interface MapAdapter {
  createMap(container: HTMLElement, options: MapCreateOptions): IMap;
}

interface PmtilesProtocolRuntime {
  protocol: Protocol;
  refCount: number;
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
      const { center, zoom, minZoom, maxZoom, style, hash } = options;
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

      const map = new maplibregl.Map(mapOptions);

      return new MapLibreEngine(map);
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
