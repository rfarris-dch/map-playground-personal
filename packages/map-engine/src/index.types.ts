import type {
  AddLayerObject,
  ControlPosition,
  ExpressionSpecification,
  IControl,
  MapGeoJSONFeature,
  PointLike,
  ProjectionSpecification,
  QueryRenderedFeaturesOptions,
  RequestParameters,
  ResourceType,
  SourceSpecification,
  StyleSpecification,
  TerrainSpecification,
} from "maplibre-gl";
import type { Protocol } from "pmtiles";

export interface PmtilesProtocolRuntime {
  protocol: Protocol;
  refCount: number;
}

export interface MapAdapter {
  createMap(container: HTMLElement, options: MapCreateOptions): IMap;
}

export interface IMap {
  addControl(control: IControl, position?: ControlPosition): void;
  addLayer(layerSpec: AddLayerObject, beforeId?: string): void;
  addSource(id: string, spec: SourceSpecification): void;
  destroy(): void;
  getBounds(): LngLatBounds;
  getCanvasSize(): { readonly height: number; readonly width: number };
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
  project(lngLat: LngLat): [number, number];
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

export interface MapPointerEvent {
  lngLat: {
    lat: number;
    lng: number;
  };
  point: [number, number];
}

export interface MapClickEvent {
  lngLat: {
    lat: number;
    lng: number;
  };
  point: [number, number];
}

export interface FeatureStateTarget {
  id: string | number;
  source: string;
  sourceLayer?: string;
}

export interface MapCreateOptions {
  readonly center: LngLat;
  readonly hash?: boolean;
  readonly maxZoom?: number;
  readonly minZoom?: number;
  readonly projection?: ProjectionSpecification;
  readonly style: StyleInput;
  readonly transformRequest?: MapRequestTransformFunction;
  readonly zoom: number;
}

export interface LngLatBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

export interface FullscreenControlOptions {
  readonly container?: HTMLElement;
}

export interface ScaleControlOptions {
  readonly maxWidth?: number;
  readonly unit?: "imperial" | "metric" | "nautical";
}

export interface NavigationControlOptions {
  readonly showCompass?: boolean;
  readonly showZoom?: boolean;
  readonly visualizePitch?: boolean;
}

export type MapControl = IControl;

export type MapExpression = ExpressionSpecification;

export type MapRequestTransformFunction = (
  url: string,
  resourceType?: ResourceType
) => RequestParameters | undefined;

export type StyleInput = StyleSpecification | string;

export type LngLat = [number, number];
