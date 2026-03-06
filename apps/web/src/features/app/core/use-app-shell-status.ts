import type { ShallowRef } from "vue";
import { computed } from "vue";
import type { PerspectiveStatusState } from "@/features/app/core/app-shell.types";
import { formatFacilitiesStatus } from "@/features/facilities/facilities.service";
import {
  formatParcelsStatus,
  readParcelsStatusIngestionRunId,
} from "@/features/parcels/parcels.service";
import type { ParcelsStatus } from "@/features/parcels/parcels.types";

interface UseAppShellStatusOptions {
  readonly facilitiesStatus: ShallowRef<PerspectiveStatusState>;
  readonly parcelsStatus: ShallowRef<ParcelsStatus>;
}

export function useAppShellStatus(options: UseAppShellStatusOptions) {
  const colocationStatusText = computed(() =>
    formatFacilitiesStatus(options.facilitiesStatus.value.colocation)
  );
  const hyperscaleStatusText = computed(() =>
    formatFacilitiesStatus(options.facilitiesStatus.value.hyperscale)
  );
  const parcelsStatusText = computed(() => formatParcelsStatus(options.parcelsStatus.value));
  const expectedParcelsIngestionRunId = computed(() =>
    readParcelsStatusIngestionRunId(options.parcelsStatus.value)
  );

  return {
    colocationStatusText,
    hyperscaleStatusText,
    parcelsStatusText,
    expectedParcelsIngestionRunId,
  };
}
