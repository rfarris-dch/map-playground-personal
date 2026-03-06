import type { UseAppShellStateResult } from "@/features/app/core/use-app-shell-state.types";

export type UseAppShellStatusResult = ReturnType<
  typeof import("./use-app-shell-status").useAppShellStatus
>;

export type UseAppShellFiberResult = ReturnType<
  typeof import("@/features/app/fiber/use-app-shell-fiber").useAppShellFiber
>;

export type UseAppShellMapLifecycleResult = ReturnType<
  typeof import("@/features/app/lifecycle/use-app-shell-map-lifecycle").useAppShellMapLifecycle
>;

export type UseAppShellMeasureSelectionResult = ReturnType<
  typeof import("@/features/app/measure-selection/use-app-shell-measure-selection").useAppShellMeasureSelection
>;

export type UseMapOverlaysResult = ReturnType<
  typeof import("@/features/app/overlays/use-map-overlays").useMapOverlays
>;

export type UseAppShellSelectionResult = ReturnType<
  typeof import("@/features/app/selection/use-app-shell-selection").useAppShellSelection
>;

export type UseAppShellVisibilityResult = ReturnType<
  typeof import("@/features/app/visibility/use-app-shell-visibility").useAppShellVisibility
>;

export interface UseAppShellRuntimeResult {
  readonly fiber: UseAppShellFiberResult;
  readonly mapLifecycle: UseAppShellMapLifecycleResult;
  readonly mapOverlays: UseMapOverlaysResult;
  readonly measureSelection: UseAppShellMeasureSelectionResult;
  readonly selection: UseAppShellSelectionResult;
  readonly state: UseAppShellStateResult;
  readonly status: UseAppShellStatusResult;
  readonly visibility: UseAppShellVisibilityResult;
}
