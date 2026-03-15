<script setup lang="ts">
  import FacilityDetailPageContent from "@/features/facilities/facility-detail/components/facility-detail-page-content.vue";
  import { useFacilityDetailPage } from "@/features/facilities/facility-detail/use-facility-detail-page";

  const page = useFacilityDetailPage();
</script>

<template>
  <FacilityDetailPageContent
    :facility-id="page.facilityId.value"
    :perspective="page.perspective.value"
    :detail="page.detail.value"
    :properties="page.properties.value"
    :geometry="page.geometry.value"
    :facility-name="page.facilityName.value"
    :is-loading="page.isLoading.value"
    :is-error="page.isError.value"
  />
</template>
