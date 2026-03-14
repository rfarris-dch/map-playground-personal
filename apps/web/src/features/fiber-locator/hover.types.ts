import type {
  FiberLocatorLayerController,
  FiberLocatorLineId,
  FiberLocatorSourceLayerOption,
} from "@/features/fiber-locator/fiber-locator.types";

export interface FiberLocatorHoverState {
  readonly featureId: number | string;
  readonly lineId: FiberLocatorLineId;
  readonly lineLabel: string;
  readonly operatorName: string | null;
  readonly screenPoint: readonly [number, number];
  readonly segmentName: string | null;
  readonly sourceLayerLabel: string;
  readonly sourceLayerName: string;
  readonly status: string | null;
}

export interface FiberLocatorHoverOptions {
  readonly getControllers: () => readonly FiberLocatorLayerController[];
  readonly getSourceLayerOptions: (
    lineId: FiberLocatorLineId
  ) => readonly FiberLocatorSourceLayerOption[];
  readonly isInteractionEnabled?: () => boolean;
  readonly onHoverChange?: (nextHover: FiberLocatorHoverState | null) => void;
}

export interface FiberLocatorHoverController {
  clear(): void;
  destroy(): void;
}
