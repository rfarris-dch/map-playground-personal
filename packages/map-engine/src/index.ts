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
  IMapMarker,
  LngLat,
  LngLatBounds,
  MapAdapter,
  MapCaptureImageOptions,
  MapClickEvent,
  MapControl,
  MapControlPosition,
  MapCreateOptions,
  MapErrorHandler,
  MapExpression,
  MapLayerSpecification,
  MapLifecycleError,
  MapPointerEvent,
  MapPointLike,
  MapProjectionSpecification,
  MapQueryRenderedFeaturesOptions,
  MapRenderedFeature,
  MapSourceFeature,
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
  IMapMarker,
  LngLat,
  LngLatBounds,
  MapAdapter,
  MapCaptureImageOptions,
  MapClickEvent,
  MapControl,
  MapControlPosition,
  MapCreateOptions,
  MapErrorHandler,
  MapExpression,
  MapLayerSpecification,
  MapLifecycleError,
  MapPointerEvent,
  MapPointLike,
  MapProjectionSpecification,
  MapQueryRenderedFeaturesOptions,
  MapRenderedFeature,
  MapRequestParameters,
  MapRequestTransformFunction,
  MapResourceType,
  MapSourceFeature,
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

function isMapWithGlobalState(
  map: unknown
): map is { setGlobalStateProperty: (name: string, value: unknown) => void } {
  if (typeof map !== "object" || map === null) {
    return false;
  }

  return typeof Reflect.get(map, "setGlobalStateProperty") === "function";
}

function isMapWithTriggerRepaint(map: unknown): map is { triggerRepaint: () => void } {
  if (typeof map !== "object" || map === null) {
    return false;
  }

  return typeof Reflect.get(map, "triggerRepaint") === "function";
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
  private readonly errorHandlers: Set<MapErrorHandler>;
  private readonly guardedHandlers: Map<() => void, () => void>;
  private readonly initialMoveEndHandlers: Map<() => void, () => void>;
  private preferredProjection: MapProjectionSpecification | null;
  private projectionLoadHandler: (() => void) | null;
  private readonly pointerLeaveHandlers: Map<() => void, () => void>;
  private readonly pointerMoveHandlers: Map<
    (event: MapPointerEvent) => void,
    (event: MapMouseEvent) => void
  >;
  private readonly styleImageMissingHandlers: Map<
    (id: string) => void,
    (event: { readonly id: string }) => void
  >;
  private readonly map: MapLibreMap;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.clickHandlers = new Map();
    this.errorHandlers = new Set();
    this.guardedHandlers = new Map();
    this.initialMoveEndHandlers = new Map();
    this.pointerMoveHandlers = new Map();
    this.pointerLeaveHandlers = new Map();
    this.styleImageMissingHandlers = new Map();
    this.preferredProjection = null;
    this.projectionLoadHandler = null;
  }

  addControl(control: MapControl, position?: MapControlPosition): void {
    this.map.addControl(control, position);
  }

  addImage(
    id: string,
    image: ImageBitmap | HTMLImageElement | ImageData | import("maplibre-gl").StyleImageInterface
  ): void {
    this.map.addImage(id, image);
  }

  replaceImage(
    id: string,
    image: ImageBitmap | HTMLImageElement | ImageData | import("maplibre-gl").StyleImageInterface
  ): void {
    if (typeof this.map.getImage(id) !== "undefined") {
      this.map.removeImage(id);
    }
    this.map.addImage(id, image);
  }

  addSource(id: string, spec: MapSourceSpecification): void {
    this.map.addSource(id, spec);
  }

  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void {
    this.map.addLayer(layerSpec, beforeId);
  }

  createHtmlMarker(element: HTMLElement, lngLat: LngLat): IMapMarker {
    const marker = new maplibregl.Marker({
      anchor: "center",
      element,
    })
      .setLngLat(lngLat)
      .addTo(this.map);

    return {
      remove(): void {
        marker.remove();
      },
      setLngLat(nextLngLat: LngLat): void {
        marker.setLngLat(nextLngLat);
      },
    };
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

  querySourceFeatures(sourceId: string, sourceLayer: string): MapSourceFeature[] {
    return this.map.querySourceFeatures(sourceId, { sourceLayer });
  }

  project(lngLat: LngLat): [number, number] {
    const point = this.map.project({
      lng: lngLat[0],
      lat: lngLat[1],
    });
    return [point.x, point.y];
  }

  unproject(point: [number, number]): LngLat {
    const lngLat = this.map.unproject(point);
    return [lngLat.lng, lngLat.lat];
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
    const shouldAnimate = viewport.animate === true;

    if (viewport.type === "bounds") {
      this.map.fitBounds(
        [
          [viewport.bounds.west, viewport.bounds.south],
          [viewport.bounds.east, viewport.bounds.north],
        ],
        {
          animate: shouldAnimate,
          ...(shouldAnimate ? { duration: 800 } : {}),
          ...(typeof viewport.padding === "number" ? { padding: viewport.padding } : {}),
          ...cameraOptions,
        }
      );
      return;
    }

    if (shouldAnimate) {
      this.map.flyTo({
        center: viewport.center,
        ...cameraOptions,
        zoom: viewport.zoom,
        duration: 800,
      });
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

  setGlobalStateProperty(name: string, value: unknown): void {
    if (!isMapWithGlobalState(this.map)) {
      return;
    }

    this.map.setGlobalStateProperty(name, value);
  }

  setLayerFilter(layerId: string, filter: MapExpression | null): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.setFilter(layerId, filter ?? undefined);
  }

  isLayerVisible(layerId: string): boolean {
    if (!this.hasLayer(layerId)) {
      return false;
    }
    return this.map.getLayoutProperty(layerId, "visibility") !== "none";
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    const nextVisibility = visible ? "visible" : "none";
    const currentVisibility = this.map.getLayoutProperty(layerId, "visibility");
    const normalizedCurrentVisibility = currentVisibility === "none" ? "none" : "visible";

    if (normalizedCurrentVisibility === nextVisibility) {
      return;
    }

    this.map.setLayoutProperty(layerId, "visibility", nextVisibility);
  }

  setPaintProperty(layerId: string, name: string, value: unknown): void {
    if (!this.hasLayer(layerId)) {
      return;
    }

    this.map.setPaintProperty(layerId, name, value);
  }

  triggerRepaint(): void {
    if (!isMapWithTriggerRepaint(this.map)) {
      return;
    }

    this.map.triggerRepaint();
  }

  onError(handler: MapErrorHandler): void {
    this.errorHandlers.add(handler);
  }

  offError(handler: MapErrorHandler): void {
    this.errorHandlers.delete(handler);
  }

  private emitError(lifecycleError: MapLifecycleError): void {
    if (this.errorHandlers.size === 0) {
      console.error(
        `[map-engine] Unhandled lifecycle error during "${lifecycleError.event}" callback.`,
        lifecycleError.error
      );
      return;
    }

    for (const errorHandler of this.errorHandlers) {
      try {
        errorHandler(lifecycleError);
      } catch (handlerError: unknown) {
        console.error(
          "[map-engine] Error handler threw while processing a lifecycle error.",
          handlerError
        );
      }
    }
  }

  private guardCallback(event: string, handler: () => void): () => void {
    const existing = this.guardedHandlers.get(handler);
    if (typeof existing === "function") {
      return existing;
    }

    const guarded = (): void => {
      try {
        handler();
      } catch (error: unknown) {
        this.emitError({ event, error });
      }
    };

    this.guardedHandlers.set(handler, guarded);
    return guarded;
  }

  on(event: "load" | "moveend", handler: () => void): void {
    const guarded = this.guardCallback(event, handler);

    if (event === "load") {
      if (this.map.isStyleLoaded()) {
        queueMicrotask(guarded);
      }

      this.map.on("style.load", guarded);
      return;
    }

    if (event === "moveend") {
      if (this.map.isStyleLoaded()) {
        queueMicrotask(guarded);
      } else {
        const initialMoveEndHandler = (): void => {
          this.map.off("style.load", initialMoveEndHandler);

          const registeredHandler = this.initialMoveEndHandlers.get(handler);
          if (registeredHandler === initialMoveEndHandler) {
            this.initialMoveEndHandlers.delete(handler);
          }

          queueMicrotask(guarded);
        };

        this.initialMoveEndHandlers.set(handler, initialMoveEndHandler);
        this.map.on("style.load", initialMoveEndHandler);
      }
    }

    this.map.on(event, guarded);
  }

  off(event: "load" | "moveend", handler: () => void): void {
    const guarded = this.guardedHandlers.get(handler);
    const effectiveHandler = typeof guarded === "function" ? guarded : handler;

    if (event === "load") {
      this.map.off("style.load", effectiveHandler);
      this.guardedHandlers.delete(handler);
      return;
    }

    if (event === "moveend") {
      const initialMoveEndHandler = this.initialMoveEndHandlers.get(handler);
      if (typeof initialMoveEndHandler === "function") {
        this.map.off("style.load", initialMoveEndHandler);
        this.initialMoveEndHandlers.delete(handler);
      }
    }

    this.map.off(event, effectiveHandler);
    this.guardedHandlers.delete(handler);
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

  onStyleImageMissing(handler: (id: string) => void): void {
    if (this.styleImageMissingHandlers.has(handler)) {
      return;
    }

    const wrappedHandler = (e: { readonly id: string }): void => {
      handler(e.id);
    };

    this.styleImageMissingHandlers.set(handler, wrappedHandler);
    this.map.on("styleimagemissing", wrappedHandler);
  }

  offStyleImageMissing(handler: (id: string) => void): void {
    const wrappedHandler = this.styleImageMissingHandlers.get(handler);
    if (!wrappedHandler) {
      return;
    }

    this.map.off("styleimagemissing", wrappedHandler);
    this.styleImageMissingHandlers.delete(handler);
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

  getClusterExpansionZoom(sourceId: string, clusterId: number): Promise<number> {
    const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source || typeof source.getClusterExpansionZoom !== "function") {
      return Promise.resolve(0);
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
    this.errorHandlers.clear();
    this.guardedHandlers.clear();
    this.pointerMoveHandlers.clear();
    this.pointerLeaveHandlers.clear();
    this.styleImageMissingHandlers.clear();
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

function buildCanvasContextAttributes(
  options: Pick<MapCreateOptions, "antialias" | "preserveDrawingBuffer">
): MapOptions["canvasContextAttributes"] | undefined {
  const canvasContextAttributes: NonNullable<MapOptions["canvasContextAttributes"]> = {};

  if (typeof options.antialias === "boolean") {
    canvasContextAttributes.antialias = options.antialias;
  }

  if (typeof options.preserveDrawingBuffer === "boolean") {
    canvasContextAttributes.preserveDrawingBuffer = options.preserveDrawingBuffer;
  }

  if (Object.keys(canvasContextAttributes).length === 0) {
    return undefined;
  }

  return canvasContextAttributes;
}

function buildMapLibreOptions(container: HTMLElement, options: MapCreateOptions): MapOptions {
  const mapOptions: MapOptions = {
    container,
    center: options.center,
    zoom: options.zoom,
    style: options.style,
    attributionControl: false,
  };

  if (typeof options.bearing === "number") {
    mapOptions.bearing = options.bearing;
  }

  if (typeof options.pitch === "number") {
    mapOptions.pitch = options.pitch;
  }

  if (typeof options.minZoom === "number") {
    mapOptions.minZoom = options.minZoom;
  }

  if (typeof options.maxZoom === "number") {
    mapOptions.maxZoom = options.maxZoom;
  }

  if (typeof options.maxPitch === "number") {
    mapOptions.maxPitch = options.maxPitch;
  }

  const canvasContextAttributes = buildCanvasContextAttributes(options);
  if (typeof canvasContextAttributes !== "undefined") {
    mapOptions.canvasContextAttributes = canvasContextAttributes;
  }

  if (typeof options.hash !== "undefined") {
    mapOptions.hash = options.hash;
  }

  if (typeof options.transformRequest === "function") {
    mapOptions.transformRequest = options.transformRequest;
  }

  return mapOptions;
}

export function createMapLibreAdapter(): MapAdapter {
  return {
    createMap(container: HTMLElement, options: MapCreateOptions): IMap {
      const mapOptions = buildMapLibreOptions(container, options);
      const map = new maplibregl.Map(mapOptions);
      const engine = new MapLibreEngine(map);
      if (typeof options.projection !== "undefined") {
        engine.setProjection(options.projection);
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
