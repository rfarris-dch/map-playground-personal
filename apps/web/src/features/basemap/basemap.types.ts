export interface BasemapProfile {
  readonly buildingSourceLayer: string;
  readonly buildingsLayerId: string;
  readonly buildingsMinZoom: number;
  readonly buildingsOpacity: number;
  readonly styleUrl: string;
}

export type BasemapLayerId =
  | "boundaries"
  | "buildings3d"
  | "labels"
  | "landmarks"
  | "roads"
  | "satellite";

export interface BasemapVisibilityState {
  readonly boundaries: boolean;
  readonly buildings3d: boolean;
  readonly labels: boolean;
  readonly landmarks: boolean;
  readonly roads: boolean;
  readonly satellite: boolean;
}

export interface BasemapLayerVisibilityController {
  destroy(): void;
  getVisible(layerId: BasemapLayerId): boolean;
  setVisible(layerId: BasemapLayerId, visible: boolean): void;
}
