<script setup lang="ts">
  import { computed } from "vue";
  import EntityDetailDrawerShell from "@/components/map/entity-detail-drawer-shell.vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatNullableMw } from "@/features/facilities/facility-detail/detail.service";
  import type { FacilityDetailPayload } from "@/features/facilities/facility-detail/detail.types";

  interface FacilityDetailDrawerProps {
    readonly detail: FacilityDetailPayload | null;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly selectedFacility: SelectedFacilityRef | null;
  }

  const props = defineProps<FacilityDetailDrawerProps>();

  const emit = defineEmits<{
    close: [];
  }>();

  const detailProperties = computed(() => props.detail?.response.feature.properties ?? null);
  const facilityName = computed(() => detailProperties.value?.facilityName ?? "Selected facility");
  const providerName = computed(() => detailProperties.value?.providerName ?? "Unknown provider");
  const eyebrow = computed(() => {
    if (props.selectedFacility === null) {
      return "Facility detail";
    }

    return `${props.selectedFacility.perspective} facility`;
  });
</script>

<template>
  <EntityDetailDrawerShell
    ariaLabel="Facility detail"
    :selected="props.selectedFacility"
    :eyebrow="eyebrow"
    :title="facilityName"
    :is-loading="props.isLoading"
    :is-error="props.isError"
    loading-message="Loading facility detail..."
    error-message="Facility detail failed to load. Try selecting the facility again."
    @close="emit('close')"
  >
    <dl v-if="props.detail !== null" class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
      <dt class="text-xs text-muted-foreground">Facility</dt>
      <dd class="m-0 text-sm">{{ facilityName }}</dd>

      <dt class="text-xs text-muted-foreground">Provider</dt>
      <dd class="m-0 text-sm">{{ providerName }}</dd>

      <dt class="text-xs text-muted-foreground">County FIPS</dt>
      <dd class="m-0 text-sm">{{ props.detail.response.feature.properties.countyFips }}</dd>

      <dt class="text-xs text-muted-foreground">Status</dt>
      <dd class="m-0 text-sm">
        {{ props.detail.response.feature.properties.commissionedSemantic }}
      </dd>

      <dt class="text-xs text-muted-foreground">Lease / Own</dt>
      <dd class="m-0 text-sm">
        {{ props.detail.response.feature.properties.leaseOrOwn ?? "n/a" }}
      </dd>

      <dt class="text-xs text-muted-foreground">Commissioned</dt>
      <dd class="m-0 text-sm">
        {{ formatNullableMw(props.detail.response.feature.properties.commissionedPowerMw) }}
      </dd>

      <dt class="text-xs text-muted-foreground">Available</dt>
      <dd class="m-0 text-sm">
        {{ formatNullableMw(props.detail.response.feature.properties.availablePowerMw) }}
      </dd>

      <dt class="text-xs text-muted-foreground">Under Construction</dt>
      <dd class="m-0 text-sm">
        {{ formatNullableMw(props.detail.response.feature.properties.underConstructionPowerMw) }}
      </dd>

      <dt class="text-xs text-muted-foreground">Planned</dt>
      <dd class="m-0 text-sm">
        {{ formatNullableMw(props.detail.response.feature.properties.plannedPowerMw) }}
      </dd>
    </dl>
  </EntityDetailDrawerShell>
</template>
