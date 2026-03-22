import type { IMap } from "@map-migration/map-engine";
import type { ShallowRef } from "vue";
import type { MapInteractionCoordinator } from "@/features/app/interaction/map-interaction.types";
import type { LayerRuntimeController } from "@/features/layers/layer-runtime.types";

export interface UseAppShellFiberOptions {
  readonly interactionCoordinator: ShallowRef<MapInteractionCoordinator | null>;
  readonly isInteractionEnabled: () => boolean;
  readonly layerRuntime: ShallowRef<LayerRuntimeController | null>;
  readonly map: ShallowRef<IMap | null>;
}
