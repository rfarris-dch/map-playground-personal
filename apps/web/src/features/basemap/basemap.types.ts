export interface BasemapProfile {
  readonly buildingSourceLayer: string;
  readonly buildingsLayerId: string;
  readonly buildingsMinZoom: number;
  readonly buildingsOpacity: number;
  readonly id: "color" | "monochrome";
  readonly styleUrl: string;
}

export type BasemapLayerId =
  | "boundaries"
  | "buildings3d"
  | "color"
  | "globe"
  | "labels"
  | "landmarks"
  | "roads"
  | "satellite"
  | "terrain";

export interface BasemapVisibilityState {
  readonly boundaries: boolean;
  readonly buildings3d: boolean;
  readonly color: boolean;
  readonly globe: boolean;
  readonly labels: boolean;
  readonly landmarks: boolean;
  readonly roads: boolean;
  readonly satellite: boolean;
  readonly terrain: boolean;
}

export interface BasemapLayerVisibilityController {
  destroy(): void;
  getVisible(layerId: BasemapLayerId): boolean;
  setLayerColor(targetLayer: string, color: string): void;
  setVisible(layerId: BasemapLayerId, visible: boolean): void;
}
