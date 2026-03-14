import type { InjectionKey } from "vue";
import { inject } from "vue";
import type { useAppShell } from "./use-app-shell";

export type MapShellContext = ReturnType<typeof useAppShell>;

export const MAP_SHELL_KEY: InjectionKey<MapShellContext> = Symbol("map-shell");

export function useMapShellContext(): MapShellContext {
  const context = inject(MAP_SHELL_KEY);
  if (context === undefined) {
    throw new Error("useMapShellContext() called outside of MapShellContext provider");
  }
  return context;
}
