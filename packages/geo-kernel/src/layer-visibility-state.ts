export interface LayerVisibilityState {
  readonly visibleLayerIds?: string[];
  readonly visibleBasemapLayerIds?: string[];
  readonly selectedBoundaryIds?: {
    readonly country?: string[];
    readonly county?: string[];
    readonly state?: string[];
  };
  readonly selectedFiberSourceLayerNames?: {
    readonly longhaul?: string[];
    readonly metro?: string[];
  };
}
