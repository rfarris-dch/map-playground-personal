import type { ShallowRef } from "vue";
import type { FacilitiesLayerController } from "@/features/facilities/facilities.types";
import type { ParcelsLayerController } from "@/features/parcels/parcels.types";

export interface UseAppShellSelectionOptions {
  readonly facilitiesControllers: ShallowRef<readonly FacilitiesLayerController[]>;
  readonly parcelsController: ShallowRef<ParcelsLayerController | null>;
}
