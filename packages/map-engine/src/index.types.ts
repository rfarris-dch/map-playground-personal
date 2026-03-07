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

export interface MapCaptureImageOptions {
  readonly quality?: number;
  readonly type?: "image/jpeg" | "image/png";
}

export interface IMap {
  addControl(control: MapControl, position?: MapControlPosition): void;
  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void;
  addSource(id: string, spec: MapSourceSpecification): void;
  captureImage(options?: MapCaptureImageOptions): Promise<Blob>;
  destroy(): void;
  getBounds(): LngLatBounds;
  getCanvasSize(): { readonly height: number; readonly width: number };
  getProjection(): MapProjectionSpecification;
  getStyle(): MapStyleSpecification;
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
    target: MapPointLike | [MapPointLike, MapPointLike],
    options?: MapQueryRenderedFeaturesOptions
  ): MapRenderedFeature[];
  removeControl(control: MapControl): void;
  removeLayer(layerId: string): void;
  removeSource(sourceId: string): void;
  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>): void;
  setGeoJSONSourceData(sourceId: string, data: unknown): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  setProjection(projection: MapProjectionSpecification): void;
  setStyle(style: StyleInput): void;
  setTerrain(terrain: MapTerrainSpecification | null): void;
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
  readonly preserveDrawingBuffer?: boolean;
  readonly projection?: MapProjectionSpecification;
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
export type MapControlPosition = ControlPosition;
export type MapLayerSpecification = AddLayerObject;

export type MapExpression = ExpressionSpecification;
export type MapPointLike = PointLike;
export type MapProjectionSpecification = ProjectionSpecification;
export type MapQueryRenderedFeaturesOptions = QueryRenderedFeaturesOptions;
export type MapRenderedFeature = MapGeoJSONFeature;
export type MapRequestParameters = RequestParameters;

export type MapRequestTransformFunction = (
  url: string,
  resourceType?: MapResourceType
) => MapRequestParameters | undefined;

export type MapResourceType = ResourceType;
export type MapSourceSpecification = SourceSpecification;
export type MapStyleLayer = NonNullable<StyleSpecification["layers"]>[number];
export type MapStyleSpecification = StyleSpecification;
export type MapTerrainSpecification = TerrainSpecification;

export type StyleInput = MapStyleSpecification | string;

export type LngLat = [number, number];
