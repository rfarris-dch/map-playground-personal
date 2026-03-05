export type PowerHoverLayerId = "plants" | "substations";

export interface PowerHoverState {
  readonly featureId: number | string | null;
  readonly layerId: PowerHoverLayerId;
  readonly layerLabel: string;
  readonly name: string | null;
  readonly operatorName: string | null;
  readonly outputMw: number | null;
  readonly screenPoint: readonly [number, number];
  readonly sourceDetail: string | null;
  readonly sourceLayerName: string | null;
  readonly status: string | null;
  readonly voltageKv: number | null;
}

export interface PowerHoverOptions {
  readonly isInteractionEnabled?: () => boolean;
  readonly onHoverChange?: (nextHover: PowerHoverState | null) => void;
}

export interface PowerHoverController {
  clear(): void;
  destroy(): void;
}

export interface HoverCandidate {
  readonly nextHover: PowerHoverState;
  readonly nextTarget: HoverTarget | null;
}

export interface HoverTarget {
  readonly featureId: number | string;
  readonly sourceId: string;
  readonly sourceLayerName: string;
}
