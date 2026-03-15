import type {
  FeatureStateTarget,
  IMap,
  IMapMarker,
  LngLat,
  LngLatBounds,
  MapClickEvent,
  MapControl,
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
  StyleInput,
} from "@map-migration/map-engine";

interface FakeMapOptions {
  readonly bearing?: number;
  readonly bounds?: LngLatBounds;
  readonly center?: LngLat;
  readonly pitch?: number;
  readonly projection?: MapProjectionSpecification;
  readonly style?: MapStyleSpecification;
  readonly zoom?: number;
}

function createDefaultStyle(): MapStyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [],
  };
}

function createDefaultBounds(): LngLatBounds {
  return {
    west: -99,
    south: 39,
    east: -97,
    north: 41,
  };
}

export class FakeMap implements IMap {
  readonly addControlCalls: Array<{ readonly control: MapControl; readonly position?: string }> =
    [];
  readonly addedImages = new Map<string, ImageBitmap | HTMLImageElement | ImageData>();
  readonly addedLayers = new Map<
    string,
    { readonly beforeId?: string; readonly spec: MapLayerSpecification }
  >();
  readonly addedSources = new Map<string, MapSourceSpecification>();
  readonly clickHandlers = new Set<(event: MapClickEvent) => void>();
  readonly createdHtmlMarkers: Array<{
    readonly element: HTMLElement;
    readonly lngLat: LngLat;
    readonly marker: IMapMarker;
  }> = [];
  destroyed = false;
  readonly eventHandlers: Record<"load" | "moveend", Set<() => void>> = {
    load: new Set(),
    moveend: new Set(),
  };
  readonly featureStateCalls: Array<{
    readonly state: Record<string, unknown>;
    readonly target: FeatureStateTarget;
  }> = [];
  readonly layerFilterCalls: Array<{
    readonly filter: MapExpression | null;
    readonly layerId: string;
  }> = [];
  readonly layerVisibilityCalls: Array<{ readonly layerId: string; readonly visible: boolean }> =
    [];
  readonly pointerLeaveHandlers = new Set<() => void>();
  readonly pointerMoveHandlers = new Set<(event: MapPointerEvent) => void>();
  readonly removedControls: MapControl[] = [];
  readonly removedLayers: string[] = [];
  readonly removedSources: string[] = [];
  readonly sourceDataCalls: Array<{ readonly data: unknown; readonly sourceId: string }> = [];
  terrain: MapTerrainSpecification | null = null;
  private bearing: number;
  private bounds: LngLatBounds;
  private center: LngLat;
  private pitch: number;
  private projection: MapProjectionSpecification;
  private style: MapStyleSpecification;
  private zoom: number;

  constructor(options: FakeMapOptions = {}) {
    this.bounds = options.bounds ?? createDefaultBounds();
    this.center = options.center ?? [-98, 40];
    this.bearing = options.bearing ?? 0;
    this.pitch = options.pitch ?? 0;
    this.projection = options.projection ?? { type: "mercator" };
    this.style = options.style ?? createDefaultStyle();
    this.zoom = options.zoom ?? 5;
  }

  addControl(control: MapControl, position?: string): void {
    this.addControlCalls.push({ control, position });
  }

  addImage(id: string, image: ImageBitmap | HTMLImageElement | ImageData): void {
    this.addedImages.set(id, image);
  }

  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void {
    this.addedLayers.set(layerSpec.id, { beforeId, spec: layerSpec });
  }

  addSource(id: string, spec: MapSourceSpecification): void {
    this.addedSources.set(id, spec);
  }

  captureImage(): Promise<Blob> {
    return Promise.reject(new Error("captureImage not implemented in FakeMap"));
  }

  createHtmlMarker(element: HTMLElement, lngLat: LngLat): IMapMarker {
    const markerState = {
      lngLat,
      removed: false,
    };
    const marker: IMapMarker = {
      remove: () => {
        markerState.removed = true;
      },
      setLngLat: (nextLngLat) => {
        markerState.lngLat = nextLngLat;
      },
    };

    this.createdHtmlMarkers.push({
      element,
      lngLat: markerState.lngLat,
      marker,
    });

    return marker;
  }

  destroy(): void {
    this.destroyed = true;
  }

  emit(event: "load" | "moveend"): void {
    for (const handler of this.eventHandlers[event]) {
      handler();
    }
  }

  getBounds(): LngLatBounds {
    return this.bounds;
  }

  getCanvasSize(): { readonly height: number; readonly width: number } {
    return {
      width: 1024,
      height: 768,
    };
  }

  getBearing(): number {
    return this.bearing;
  }

  getCenter(): LngLat {
    return this.center;
  }

  getClusterExpansionZoom(): Promise<number> {
    return Promise.resolve(this.zoom + 1);
  }

  getClusterLeaves(): Promise<MapRenderedFeature[]> {
    return Promise.resolve([]);
  }

  getPitch(): number {
    return this.pitch;
  }

  getProjection(): MapProjectionSpecification {
    return this.projection;
  }

  getStyle(): MapStyleSpecification {
    return this.style;
  }

  getZoom(): number {
    return this.zoom;
  }

  hasImage(id: string): boolean {
    return this.addedImages.has(id);
  }

  hasLayer(layerId: string): boolean {
    return this.addedLayers.has(layerId);
  }

  hasSource(sourceId: string): boolean {
    return this.addedSources.has(sourceId);
  }

  loadImage(): Promise<ImageBitmap | HTMLImageElement | ImageData> {
    return Promise.reject(new Error("loadImage not implemented in FakeMap"));
  }

  off(event: "load" | "moveend", handler: () => void): void {
    this.eventHandlers[event].delete(handler);
  }

  offClick(handler: (event: MapClickEvent) => void): void {
    this.clickHandlers.delete(handler);
  }

  offPointerLeave(handler: () => void): void {
    this.pointerLeaveHandlers.delete(handler);
  }

  offPointerMove(handler: (event: MapPointerEvent) => void): void {
    this.pointerMoveHandlers.delete(handler);
  }

  onStyleImageMissing(_handler: (id: string) => void): void {
    /* stub */
  }

  offStyleImageMissing(_handler: (id: string) => void): void {
    /* stub */
  }

  on(event: "load" | "moveend", handler: () => void): void {
    this.eventHandlers[event].add(handler);
  }

  onClick(handler: (event: MapClickEvent) => void): void {
    this.clickHandlers.add(handler);
  }

  onPointerLeave(handler: () => void): void {
    this.pointerLeaveHandlers.add(handler);
  }

  onPointerMove(handler: (event: MapPointerEvent) => void): void {
    this.pointerMoveHandlers.add(handler);
  }

  project(): [number, number] {
    return [0, 0];
  }

  queryRenderedFeatures(
    _target: MapPointLike | [MapPointLike, MapPointLike],
    _options?: MapQueryRenderedFeaturesOptions
  ): MapRenderedFeature[] {
    return [];
  }

  removeControl(control: MapControl): void {
    this.removedControls.push(control);
  }

  removeLayer(layerId: string): void {
    this.removedLayers.push(layerId);
    this.addedLayers.delete(layerId);
  }

  removeSource(sourceId: string): void {
    this.removedSources.push(sourceId);
    this.addedSources.delete(sourceId);
  }

  setBounds(bounds: LngLatBounds): void {
    this.bounds = bounds;
  }

  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>): void {
    this.featureStateCalls.push({ target, state });
  }

  setGeoJSONSourceData(sourceId: string, data: unknown): void {
    this.sourceDataCalls.push({ sourceId, data });
  }

  setLayerFilter(layerId: string, filter: MapExpression | null): void {
    this.layerFilterCalls.push({ layerId, filter });
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.layerVisibilityCalls.push({ layerId, visible });
  }

  setPaintProperty(_layerId: string, _name: string, _value: unknown): void {
    // no-op in tests
  }

  setProjection(projection: MapProjectionSpecification): void {
    this.projection = projection;
  }

  setStyle(style: StyleInput): void {
    if (typeof style === "string") {
      return;
    }

    this.style = style;
  }

  setTerrain(terrain: MapTerrainSpecification | null): void {
    this.terrain = terrain;
  }

  setViewport(viewport: MapViewport): void {
    if (viewport.type === "bounds") {
      this.bounds = viewport.bounds;
    }

    if (viewport.type === "center") {
      this.center = viewport.center;
      this.zoom = viewport.zoom;
    }

    if (typeof viewport.bearing === "number") {
      this.bearing = viewport.bearing;
    }

    if (typeof viewport.pitch === "number") {
      this.pitch = viewport.pitch;
    }
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }

  unproject(): LngLat {
    return this.center;
  }
}

export function createTestMapControl(_id: string): MapControl {
  return {
    onAdd(_map): HTMLElement {
      throw new Error("test control onAdd should not be called");
    },
    onRemove(): void {
      /* noop */
    },
  };
}
