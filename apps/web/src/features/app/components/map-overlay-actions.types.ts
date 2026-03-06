export interface MapOverlayActionsProps {
  readonly overlaysBlockedReason: string | null;
  readonly quickViewActive: boolean;
  readonly quickViewDisabledReason: string | null;
  readonly scannerActive: boolean;
}

export interface MapOverlayActionsEmits {
  "toggle-quick-view": [];
  "toggle-scanner": [];
}
