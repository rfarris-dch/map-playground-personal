import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { parseFacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { fetchFacilityDetail } from "@/features/facilities/facility-detail/detail.api";
import { unwrapFacilityDetailResult } from "@/features/facilities/facility-detail/detail.service";
import type { FacilityDetailPayload } from "@/features/facilities/facility-detail/detail.types";

export function useFacilityDetailPage() {
  const route = useRoute();

  const facilityId = computed(() => {
    const value = route.params.facilityId;
    return typeof value === "string" ? value : null;
  });

  const perspective = computed<FacilityPerspective | null>(() => {
    const value = route.params.perspective;
    if (typeof value !== "string") {
      return null;
    }
    return parseFacilityPerspective(value);
  });

  const query = useQuery<FacilityDetailPayload, Error>({
    queryKey: computed(() => ["facility-detail-page", perspective.value, facilityId.value]),
    queryFn: async ({ signal }) => {
      if (perspective.value === null || facilityId.value === null) {
        throw new Error(
          `Missing required params: ${perspective.value === null ? "perspective" : ""}${perspective.value === null && facilityId.value === null ? " and " : ""}${facilityId.value === null ? "facility id" : ""}`
        );
      }

      return unwrapFacilityDetailResult(
        await fetchFacilityDetail({
          facilityId: facilityId.value,
          perspective: perspective.value,
          signal,
        })
      );
    },
    enabled: computed(() => facilityId.value !== null && perspective.value !== null),
  });

  const detail = computed(() => query.data.value ?? null);
  const properties = computed(() => detail.value?.response.feature.properties ?? null);
  const geometry = computed(() => detail.value?.response.feature.geometry ?? null);
  const facilityName = computed(() => properties.value?.facilityName ?? "Facility");

  return {
    facilityId,
    perspective,
    detail,
    properties,
    geometry,
    facilityName,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export type FacilityDetailPage = ReturnType<typeof useFacilityDetailPage>;
