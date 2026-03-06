import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { fetchParcelDetail } from "@/features/parcels/parcel-detail/detail.api";
import { unwrapParcelDetailResult } from "@/features/parcels/parcel-detail/detail.service";
import type {
  ParcelDetailQueryKey,
  ParcelDetailRequest,
} from "@/features/parcels/parcel-detail/detail.types";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";

function buildParcelDetailQueryKey(selectedParcel: SelectedParcelRef | null): ParcelDetailQueryKey {
  if (selectedParcel === null) {
    return ["parcel-detail", null, null];
  }

  return ["parcel-detail", selectedParcel.parcelId, selectedParcel.expectedIngestionRunId ?? null];
}

export function useParcelDetailQuery(selectedParcel: Ref<SelectedParcelRef | null>) {
  const queryKey = computed(() => buildParcelDetailQueryKey(selectedParcel.value));
  const enabled = computed(() => selectedParcel.value !== null);

  return useQuery({
    queryKey,
    queryFn: async ({ signal, queryKey: activeQueryKey }) => {
      const parcelId = activeQueryKey[1];
      const expectedIngestionRunId = activeQueryKey[2];
      if (typeof parcelId !== "string" || parcelId.trim().length === 0) {
        throw new Error("parcel id is required");
      }

      const request: ParcelDetailRequest =
        typeof expectedIngestionRunId === "string" && expectedIngestionRunId.trim().length > 0
          ? {
              includeGeometry: "none",
              parcelId,
              profile: "analysis_v1",
              signal,
              expectedIngestionRunId,
            }
          : {
              includeGeometry: "none",
              parcelId,
              profile: "analysis_v1",
              signal,
            };

      const result = await fetchParcelDetail(request);
      return unwrapParcelDetailResult(result);
    },
    enabled,
  });
}
