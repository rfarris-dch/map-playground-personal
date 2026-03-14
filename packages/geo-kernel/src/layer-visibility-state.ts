export interface LayerVisibilityState {
  readonly selectedBoundaryIds?: {
    readonly country?: string[];
    readonly county?: string[];
    readonly state?: string[];
  };
  readonly selectedFiberSourceLayerNames?: {
    readonly longhaul?: string[];
    readonly metro?: string[];
  };
  readonly visibleBasemapLayerIds?: string[];
  readonly visibleLayerIds?: string[];
}
