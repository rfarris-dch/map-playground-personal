import type {
  FeatureStateTarget,
  IMap,
  LngLatBounds,
  MapClickEvent,
  MapControl,
  MapLayerSpecification,
  MapPointerEvent,
  MapPointLike,
  MapProjectionSpecification,
  MapQueryRenderedFeaturesOptions,
  MapRenderedFeature,
  MapSourceSpecification,
  MapStyleSpecification,
  MapTerrainSpecification,
  StyleInput,
} from "@map-migration/map-engine";

interface FakeMapOptions {
  readonly bounds?: LngLatBounds;
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
  readonly addedLayers = new Map<
    string,
    { readonly beforeId?: string; readonly spec: MapLayerSpecification }
  >();
  readonly addedSources = new Map<string, MapSourceSpecification>();
  readonly clickHandlers = new Set<(event: MapClickEvent) => void>();
  destroyed = false;
  readonly eventHandlers: Record<"load" | "moveend", Set<() => void>> = {
    load: new Set(),
    moveend: new Set(),
  };
  readonly featureStateCalls: Array<{
    readonly state: Record<string, unknown>;
    readonly target: FeatureStateTarget;
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
  private bounds: LngLatBounds;
  private projection: MapProjectionSpecification;
  private style: MapStyleSpecification;
  private zoom: number;

  constructor(options: FakeMapOptions = {}) {
    this.bounds = options.bounds ?? createDefaultBounds();
    this.projection = options.projection ?? { type: "mercator" };
    this.style = options.style ?? createDefaultStyle();
    this.zoom = options.zoom ?? 5;
  }

  addControl(control: MapControl, position?: string): void {
    this.addControlCalls.push({ control, position });
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

  getProjection(): MapProjectionSpecification {
    return this.projection;
  }

  getStyle(): MapStyleSpecification {
    return this.style;
  }

  getZoom(): number {
    return this.zoom;
  }

  hasLayer(layerId: string): boolean {
    return this.addedLayers.has(layerId);
  }

  hasSource(sourceId: string): boolean {
    return this.addedSources.has(sourceId);
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

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.layerVisibilityCalls.push({ layerId, visible });
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

  setZoom(zoom: number): void {
    this.zoom = zoom;
  }
}

export function createTestMapControl(id: string): MapControl {
  return {
    id,
    onAdd(): HTMLElement {
      throw new Error("test control onAdd should not be called");
    },
    onRemove(): void {
      /* noop */
    },
  };
}
