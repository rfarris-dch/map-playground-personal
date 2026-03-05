import type { IMap } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";

export interface UseAppShellFiberOptions {
  readonly isInteractionEnabled: () => boolean;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly map: ShallowRef<IMap | null>;
}
