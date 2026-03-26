import type { IMap } from "@map-migration/map-engine";

interface LayerVisibilityControllerState {
  ready: boolean;
  visible: boolean;
}

interface LayerVisibilityController {
  destroy(): void;
  setVisible(visible: boolean): void;
}

interface MountLayerVisibilityControllerOptions {
  readonly applyVisibility: (visible: boolean) => void;
  readonly destroyLayers?: () => void;
  readonly ensureReady: () => void;
  readonly initiallyVisible?: boolean;
  readonly map: IMap;
  readonly startWhenStyleReady?: boolean;
}

export function mountLayerVisibilityController(
  options: MountLayerVisibilityControllerOptions
): LayerVisibilityController {
  const state: LayerVisibilityControllerState = {
    ready: false,
    visible: options.initiallyVisible ?? true,
  };

  const onLoad = (): void => {
    state.ready = true;
    options.ensureReady();
    options.applyVisibility(state.visible);
  };

  options.map.on("load", onLoad);
  if (options.startWhenStyleReady && (options.map.getStyle()?.layers?.length ?? 0) > 0) {
    onLoad();
  }

  return {
    destroy(): void {
      options.map.off("load", onLoad);
      options.destroyLayers?.();
    },
    setVisible(visible: boolean): void {
      state.visible = visible;
      if (!state.ready) {
        return;
      }

      options.applyVisibility(visible);
    },
  };
}
