import type { BBox } from "@map-migration/geo-kernel/geometry";

export type MapInteractionEventType = "load" | "moveend";

export type MapInteractionType = "initial" | "pan" | "rotate-only" | "zoom";

export type MapInteractionTaskPriority = "background" | "critical" | "idle";

export interface MapInteractionSnapshot {
  readonly bearing: number;
  readonly bearingDelta: number;
  readonly canonicalViewportKey: string;
  readonly eventType: MapInteractionEventType;
  readonly interactionType: MapInteractionType;
  readonly pitch: number;
  readonly pitchDelta: number;
  readonly quantizedBbox: BBox;
  readonly zoom: number;
  readonly zoomBucket: number;
  readonly zoomDelta: number;
}

export type MapInteractionListener = (snapshot: MapInteractionSnapshot) => void;

export interface MapInteractionSubscribeOptions {
  readonly emitCurrent?: boolean;
  readonly priority?: MapInteractionTaskPriority;
}

export interface MapInteractionCoordinator {
  destroy(): void;
  getLastSnapshot(): MapInteractionSnapshot | null;
  subscribe(listener: MapInteractionListener, options?: MapInteractionSubscribeOptions): () => void;
}
