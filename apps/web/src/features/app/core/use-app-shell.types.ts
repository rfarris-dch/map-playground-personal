import type { UseAppShellStateResult } from "@/features/app/core/use-app-shell-state.types";
import type { UseMapFiltersResult } from "@/features/app/filters/use-map-filters";

export type UseAppShellStatusResult = ReturnType<
  typeof import("./use-app-shell-status").useAppShellStatus
>;

export type UseAppShellFiberResult = ReturnType<
  typeof import("@/features/app/fiber/use-app-shell-fiber").useAppShellFiber
>;

export type UseAppShellMapLifecycleResult = ReturnType<
  typeof import("@/features/app/lifecycle/use-app-shell-map-lifecycle").useAppShellMapLifecycle
>;

export type UseAppShellSelectionAnalysisResult = ReturnType<
  typeof import("@/features/app/selection/use-app-shell-selection-analysis").useAppShellSelectionAnalysis
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
  readonly mapFilters: UseMapFiltersResult;
  readonly mapLifecycle: UseAppShellMapLifecycleResult;
  readonly mapOverlays: UseMapOverlaysResult;
  readonly selection: UseAppShellSelectionResult;
  readonly selectionAnalysis: UseAppShellSelectionAnalysisResult;
  readonly state: UseAppShellStateResult;
  readonly status: UseAppShellStatusResult;
  readonly visibility: UseAppShellVisibilityResult;
}
