export interface MapOverlayActionsProps {
  readonly overlaysBlockedReason: string | null;
  readonly quickViewActive: boolean;
  readonly quickViewDisabledReason: string | null;
  readonly scannerActive: boolean;
  readonly selectionActive: boolean;
  readonly selectionDisabledReason: string | null;
  readonly sketchMeasureActive: boolean;
}

export interface MapOverlayActionsEmits {
  "toggle-quick-view": [];
  "toggle-scanner": [];
  "toggle-selection-panel": [];
  "toggle-sketch-measure-panel": [];
}
