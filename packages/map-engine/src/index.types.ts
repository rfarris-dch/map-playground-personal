import type {
  AddLayerObject,
  ControlPosition,
  ExpressionSpecification,
  GeoJSONFeature,
  IControl,
  MapGeoJSONFeature,
  PointLike,
  ProjectionSpecification,
  QueryRenderedFeaturesOptions,
  RequestParameters,
  ResourceType,
  SourceSpecification,
  StyleImageInterface,
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

export interface MapImageData {
  readonly data: Uint8Array | Uint8ClampedArray;
  readonly height: number;
  readonly width: number;
}

export interface IMap {
  addControl(control: MapControl, position?: MapControlPosition): void;
  addImage(
    id: string,
    image: ImageBitmap | HTMLImageElement | ImageData | MapImageData | StyleImageInterface
  ): void;
  addLayer(layerSpec: MapLayerSpecification, beforeId?: string): void;
  addSource(id: string, spec: MapSourceSpecification): void;
  captureImage(options?: MapCaptureImageOptions): Promise<Blob>;
  createHtmlMarker(element: HTMLElement, lngLat: LngLat): IMapMarker;
  destroy(): void;
  getBearing(): number;
  getBounds(): LngLatBounds;
  getCanvasSize(): { readonly height: number; readonly width: number };
  getCenter(): LngLat;

  getClusterExpansionZoom(sourceId: string, clusterId: number): Promise<number>;

  getClusterLeaves(
    sourceId: string,
    clusterId: number,
    limit: number
  ): Promise<MapRenderedFeature[]>;
  getImageData(id: string): MapImageData | null;
  getPitch(): number;
  getProjection(): MapProjectionSpecification;
  getStyle(): MapStyleSpecification;
  getZoom(): number;
  hasImage(id: string): boolean;
  hasLayer(layerId: string): boolean;
  hasSource(sourceId: string): boolean;
  isLayerVisible(layerId: string): boolean;
  listImageIds(): readonly string[];
  loadImage(url: string): Promise<ImageBitmap | HTMLImageElement | ImageData>;
  off(event: "idle" | "load" | "moveend", handler: () => void): void;
  offClick(handler: (event: MapClickEvent) => void): void;
  offError(handler: MapErrorHandler): void;
  offPointerLeave(handler: () => void): void;
  offPointerMove(handler: (event: MapPointerEvent) => void): void;
  offStyleImageMissing(handler: (id: string) => void): void;
  on(event: "idle" | "load" | "moveend", handler: () => void): void;
  onClick(handler: (event: MapClickEvent) => void): void;
  onError(handler: MapErrorHandler): void;
  onPointerLeave(handler: () => void): void;
  onPointerMove(handler: (event: MapPointerEvent) => void): void;
  onStyleImageMissing(handler: (id: string) => void): void;
  project(lngLat: LngLat): [number, number];
  queryRenderedFeatures(
    target: MapPointLike | [MapPointLike, MapPointLike],
    options?: MapQueryRenderedFeaturesOptions
  ): MapRenderedFeature[];
  querySourceFeatures(sourceId: string, sourceLayer: string): MapSourceFeature[];
  removeControl(control: MapControl): void;
  removeLayer(layerId: string): void;
  removeSource(sourceId: string): void;
  replaceImage(
    id: string,
    image: ImageBitmap | HTMLImageElement | ImageData | MapImageData | StyleImageInterface
  ): void;
  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>): void;
  setGeoJSONSourceData(sourceId: string, data: unknown): void;
  setGlobalStateProperty(name: string, value: unknown): void;
  setLayerFilter(layerId: string, filter: MapExpression | null): void;
  setLayerVisibility(layerId: string, visible: boolean): void;
  setPaintProperty(layerId: string, name: string, value: unknown): void;
  setProjection(projection: MapProjectionSpecification): void;
  setStyle(style: StyleInput): void;
  setTerrain(terrain: MapTerrainSpecification | null): void;
  setViewport(viewport: MapViewport): void;
  triggerRepaint(): void;
  unproject(point: [number, number]): LngLat;
}

export interface MapPointerEvent {
  readonly buttons: number;
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
  readonly antialias?: boolean;
  readonly bearing?: number;
  readonly center: LngLat;
  readonly hash?: boolean;
  readonly maxPitch?: number;
  readonly maxZoom?: number;
  readonly minZoom?: number;
  readonly pitch?: number;
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

export interface MapLifecycleError {
  /** The underlying error thrown by the callback. */
  readonly error: unknown;
  /** The lifecycle event during which the error occurred (e.g. "load", "moveend"). */
  readonly event: string;
}

export type MapErrorHandler = (lifecycleError: MapLifecycleError) => void;

export interface IMapMarker {
  remove(): void;
  setLngLat(lngLat: LngLat): void;
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
export type MapSourceFeature = GeoJSONFeature;
export type MapRequestParameters = RequestParameters;
export type MapViewport =
  | {
      readonly animate?: boolean;
      readonly bearing?: number;
      readonly center: LngLat;
      readonly pitch?: number;
      readonly type: "center";
      readonly zoom: number;
    }
  | {
      readonly animate?: boolean;
      readonly bearing?: number;
      readonly bounds: LngLatBounds;
      readonly padding?: number;
      readonly pitch?: number;
      readonly type: "bounds";
    };

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
