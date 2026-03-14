import type { Ref } from "vue";
import { fetchParcelDetail } from "@/features/parcels/parcel-detail/detail.api";
import { unwrapParcelDetailResult } from "@/features/parcels/parcel-detail/detail.service";
import type {
  ParcelDetailQueryKey,
  ParcelDetailRequest,
} from "@/features/parcels/parcel-detail/detail.types";
import type { SelectedParcelRef } from "@/features/parcels/parcels.types";
import { createEntityDetailQuery } from "@/lib/api/entity-detail-query.service";

function buildParcelDetailQueryKey(selectedParcel: SelectedParcelRef | null): ParcelDetailQueryKey {
  if (selectedParcel === null) {
    return ["parcel-detail", null, null];
  }

  return ["parcel-detail", selectedParcel.parcelId, selectedParcel.expectedIngestionRunId ?? null];
}

export function useParcelDetailQuery(selectedParcel: Ref<SelectedParcelRef | null>) {
  return createEntityDetailQuery({
    buildQueryKey: buildParcelDetailQueryKey,
    isEnabled(nextSelectedParcel) {
      return nextSelectedParcel !== null;
    },
    query: async ({ queryKey, signal }) => {
      const parcelId = queryKey[1];
      const expectedIngestionRunId = queryKey[2];
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

      return unwrapParcelDetailResult(await fetchParcelDetail(request));
    },
    selected: selectedParcel,
  });
}
