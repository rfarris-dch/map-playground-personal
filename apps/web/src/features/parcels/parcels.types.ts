export type TileDataset =
  | "parcels"
  | "parcels-draw-v1"
  | "parcels-analysis-v1"
  | "infrastructure"
  | "power"
  | "telecom";

export interface TileManifestEntry {
  readonly checksum: string;
  readonly dataset: TileDataset;
  readonly ingestionRunId?: string;
  readonly url: string;
  readonly version: string;
}

export interface TilePublishManifest {
  readonly current: TileManifestEntry;
  readonly dataset: TileDataset;
  readonly previous: TileManifestEntry | null;
  readonly publishedAt: string;
}

export interface MapBoundsLike {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export interface SelectedParcelRef {
  readonly expectedIngestionRunId?: string;
  readonly parcelId: string;
}

export type ParcelsGuardrailReason = "stress" | "tile-cap" | "viewport-span";

export interface ParcelsGuardrailResult {
  readonly blocked: boolean;
  readonly predictedTileCount: number;
  readonly reason: ParcelsGuardrailReason | null;
  readonly viewportWidthKm: number;
}

export type ParcelsStatus =
  | { readonly state: "idle" }
  | { readonly state: "loading-manifest" }
  | {
      readonly state: "ready";
      readonly dataset: TileDataset;
      readonly ingestionRunId?: string;
      readonly predictedTileCount: number;
      readonly version: string;
      readonly viewportWidthKm: number;
    }
  | {
      readonly state: "hidden";
      readonly predictedTileCount: number;
      readonly reason: ParcelsGuardrailReason;
      readonly viewportWidthKm: number;
    }
  | {
      readonly state: "error";
      readonly reason: string;
    };

export interface ParcelsLayerOptions {
  readonly disableGuardrails?: boolean;
  readonly isInteractionEnabled?: () => boolean;
  readonly manifestPath?: string;
  readonly maxPredictedTiles?: number;
  readonly maxTilePredictionZoom?: number;
  readonly maxViewportWidthKm?: number;
  readonly onSelectParcel?: (parcel: SelectedParcelRef | null) => void;
  readonly onStatus?: (status: ParcelsStatus) => void;
  readonly onStressBlockedChange?: (blocked: boolean) => void;
  readonly sourceLayer?: string;
}

export interface ParcelsLayerController {
  clearSelection(): void;
  destroy(): void;
  setVisible(visible: boolean): void;
}

export interface ParcelsLayerState {
  guardrail: ParcelsGuardrailResult | null;
  hoverFeatureId: number | string | null;
  manifest: TilePublishManifest | null;
  ready: boolean;
  selectedFeatureId: number | string | null;
  selectedParcelId: string | null;
  sourceInitializationPromise: Promise<void> | null;
  sourceInitialized: boolean;
  stressBlocked: boolean;
  visible: boolean;
}

export interface LoadParcelsManifestArgs {
  readonly manifestPath: string;
  readonly signal?: AbortSignal;
}

export interface EvaluateParcelsGuardrailsArgs {
  readonly bounds: MapBoundsLike;
  readonly isStressBlocked: boolean;
  readonly maxPredictedTiles: number;
  readonly maxTilePredictionZoom: number;
  readonly maxViewportWidthKm: number;
  readonly zoom: number;
}
