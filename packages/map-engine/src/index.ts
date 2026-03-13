import maplibregl, {
  type AddProtocolAction,
  addProtocol,
  type GeoJSONSource,
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
  MapCaptureImageOptions,
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
  MapSourceSpecification,
  MapStyleSpecification,
  MapTerrainSpecification,
  MapViewport,
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
  MapCaptureImageOptions,
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
  MapViewport,
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

const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function normalizeViewportLongitudes(
  rawWest: number,
  rawEast: number
): {
  readonly east: number;
  readonly west: number;
} {
  const west = clamp(rawWest, MIN_LONGITUDE, MAX_LONGITUDE);
  const east = clamp(rawEast, MIN_LONGITUDE, MAX_LONGITUDE);

  if (west < east) {
    return { west, east };
  }

  return {
    west: MIN_LONGITUDE,
    east: MAX_LONGITUDE,
  };
}

function buildViewportCameraOptions(viewport: MapViewport): {
  readonly bearing?: number;
  readonly pitch?: number;
} {
  return {
    ...(typeof viewport.bearing === "number" ? { bearing: viewport.bearing } : {}),
    ...(typeof viewport.pitch === "number" ? { pitch: viewport.pitch } : {}),
  };
}

class MapLibreEngine implements IMap {
  private readonly clickHandlers: Map<
    (event: MapClickEvent) => void,
    (event: MapMouseEvent) => void
  >;
  private readonly initialMoveEndHandlers: Map<() => void, () => void>;
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
    this.initialMoveEndHandlers = new Map();
    this.pointerMoveHandlers = new Map();
    this.pointerLeaveHandlers = new Map();
    this.preferredProjection = null;
    this.projectionLoadHandler = null;
  }

  addControl(control: MapControl, position?: MapControlPosition): void {
    this.map.addControl(control, position);
  }

  addImage(id: string, image: ImageBitmap | HTMLImageElement | ImageData): void {
    this.map.addImage(id, image);
  }

  addSource(id: string, spec: MapSourceSpecification): void {
    this.map.addSource(id, spec);
  }

  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void {
    this.map.addLayer(layerSpec, beforeId);
  }

  captureImage(options: MapCaptureImageOptions = {}): Promise<Blob> {
    const imageType = options.type ?? "image/jpeg";
    const imageQuality = imageType === "image/jpeg" ? (options.quality ?? 0.92) : undefined;

    return new Promise((resolve, reject) => {
      this.map.getCanvas().toBlob(
        (blob) => {
          if (blob === null) {
            reject(new Error("[map-engine] Failed to capture map image."));
            return;
          }

          resolve(blob);
        },
        imageType,
        imageQuality
      );
    });
  }

  hasImage(id: string): boolean {
    return this.map.hasImage(id);
  }

  hasSource(sourceId: string): boolean {
    return typeof this.map.getSource(sourceId) !== "undefined";
  }

  hasLayer(layerId: string): boolean {
    return typeof this.map.getLayer(layerId) !== "undefined";
  }

  async loadImage(url: string): Promise<ImageBitmap | HTMLImageElement | ImageData> {
    const response = await this.map.loadImage(url);
    return response.data;
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
    const longitudes = normalizeViewportLongitudes(bounds.getWest(), bounds.getEast());

    return {
      west: longitudes.west,
      south: clamp(bounds.getSouth(), MIN_LATITUDE, MAX_LATITUDE),
      east: longitudes.east,
      north: clamp(bounds.getNorth(), MIN_LATITUDE, MAX_LATITUDE),
    };
  }

  getZoom(): number {
    return this.map.getZoom();
  }

  getCenter(): LngLat {
    const center = this.map.getCenter();
    return [center.lng, center.lat];
  }

  getBearing(): number {
    return this.map.getBearing();
  }

  getPitch(): number {
    return this.map.getPitch();
  }

  getStyle(): MapStyleSpecification {
    return this.map.getStyle();
  }

  getProjection(): MapProjectionSpecification {
    return this.map.getProjection();
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

  setViewport(viewport: MapViewport): void {
    const cameraOptions = buildViewportCameraOptions(viewport);

    if (viewport.type === "bounds") {
      this.map.fitBounds(
        [
          [viewport.bounds.west, viewport.bounds.south],
          [viewport.bounds.east, viewport.bounds.north],
        ],
        {
          animate: false,
          ...cameraOptions,
        }
      );
      return;
    }

    this.map.jumpTo({
      center: viewport.center,
      ...cameraOptions,
      zoom: viewport.zoom,
    });
  }

  setGeoJSONSourceData(sourceId: string, data: unknown): void {
    const source = this.map.getSource(sourceId);
    if (!isSourceWithSetData(source)) {
      throw new Error(`[map-engine] Source "${sourceId}" does not support setData().`);
    }

    source.setData(data);
  }

  setLayerFilter(layerId: string, filter: MapExpression | null): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.setFilter(layerId, filter ?? undefined);
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }

  on(event: "load" | "moveend", handler: () => void): void {
    if (event === "load") {
      if (this.map.isStyleLoaded()) {
        queueMicrotask(handler);
      }

      this.map.on("style.load", handler);
      return;
    }

    if (event === "moveend") {
      if (this.map.isStyleLoaded()) {
        queueMicrotask(handler);
      } else {
        const initialMoveEndHandler = (): void => {
          this.map.off("style.load", initialMoveEndHandler);

          const registeredHandler = this.initialMoveEndHandlers.get(handler);
          if (registeredHandler === initialMoveEndHandler) {
            this.initialMoveEndHandlers.delete(handler);
          }

          queueMicrotask(handler);
        };

        this.initialMoveEndHandlers.set(handler, initialMoveEndHandler);
        this.map.on("style.load", initialMoveEndHandler);
      }
    }

    this.map.on(event, handler);
  }

  off(event: "load" | "moveend", handler: () => void): void {
    if (event === "load") {
      this.map.off("style.load", handler);
      return;
    }

    if (event === "moveend") {
      const initialMoveEndHandler = this.initialMoveEndHandlers.get(handler);
      if (typeof initialMoveEndHandler === "function") {
        this.map.off("style.load", initialMoveEndHandler);
        this.initialMoveEndHandlers.delete(handler);
      }
    }

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

  async getClusterLeaves(
    sourceId: string,
    clusterId: number,
    limit: number
  ): Promise<MapRenderedFeature[]> {
    const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getClusterLeaves !== "function") {
      return [];
    }

    const features = await source.getClusterLeaves(clusterId, limit, 0);
    return (features ?? []) as unknown as MapRenderedFeature[];
  }

  async getClusterExpansionZoom(sourceId: string, clusterId: number): Promise<number> {
    const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getClusterExpansionZoom !== "function") {
      return 0;
    }

    return source.getClusterExpansionZoom(clusterId);
  }

  private readMouseButtons(event: MapMouseEvent): number {
    const originalEvent = Reflect.get(event, "originalEvent");
    if (!(originalEvent instanceof MouseEvent)) {
      return 0;
    }

    return originalEvent.buttons;
  }

  private toPointerEvent(event: MapMouseEvent): MapPointerEvent {
    return {
      buttons: this.readMouseButtons(event),
      lngLat: {
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      },
      point: [event.point.x, event.point.y],
    };
  }

  destroy(): void {
    this.stopProjectionListeners();
    for (const initialMoveEndHandler of this.initialMoveEndHandlers.values()) {
      this.map.off("style.load", initialMoveEndHandler);
    }
    this.initialMoveEndHandlers.clear();
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
      const {
        bearing,
        center,
        hash,
        maxPitch,
        maxZoom,
        minZoom,
        pitch,
        preserveDrawingBuffer,
        projection,
        style,
        transformRequest,
        zoom,
      } = options;
      const mapOptions: MapOptions = {
        container,
        center,
        zoom,
        style,
      };

      if (typeof bearing === "number") {
        mapOptions.bearing = bearing;
      }

      if (typeof pitch === "number") {
        mapOptions.pitch = pitch;
      }
      if (typeof minZoom === "number") {
        mapOptions.minZoom = minZoom;
      }
      if (typeof maxZoom === "number") {
        mapOptions.maxZoom = maxZoom;
      }
      if (typeof maxPitch === "number") {
        mapOptions.maxPitch = maxPitch;
      }
      if (typeof preserveDrawingBuffer === "boolean") {
        mapOptions.canvasContextAttributes = {
          preserveDrawingBuffer,
        };
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
