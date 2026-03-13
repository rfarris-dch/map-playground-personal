<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
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

  function onClose(): void {
    emit("close");
  }
</script>

<template>
  <aside
    v-if="props.selectedFacility !== null"
    class="map-glass-elevated pointer-events-auto absolute right-4 top-4 z-10 w-[min(24rem,calc(100%-2rem))] rounded-lg p-4"
    aria-label="Facility detail"
  >
    <header class="mb-3 flex items-center gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-tight">
        {{ props.selectedFacility.perspective }}
        facility
      </h2>
      <p class="m-0 truncate text-xs font-medium">{{ facilityName }}</p>
      <Button variant="glass" size="sm" class="ml-auto" @click="onClose">Close</Button>
    </header>

    <p v-if="props.isLoading" class="m-0 text-xs font-mono text-muted-foreground">
      Loading detail...
    </p>
    <p v-else-if="props.isError" class="m-0 text-xs font-mono text-muted-foreground">
      Detail load failed.
    </p>
    <template v-else-if="props.detail !== null">
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt class="text-muted-foreground">Request</dt>
        <dd class="m-0 font-mono">{{ props.detail.requestId }}</dd>

        <dt class="text-muted-foreground">Facility</dt>
        <dd class="m-0">{{ facilityName }}</dd>

        <dt class="text-muted-foreground">Provider</dt>
        <dd class="m-0">{{ providerName }}</dd>

        <dt class="text-muted-foreground">County FIPS</dt>
        <dd class="m-0">{{ props.detail.response.feature.properties.countyFips }}</dd>

        <dt class="text-muted-foreground">Semantic</dt>
        <dd class="m-0">{{ props.detail.response.feature.properties.commissionedSemantic }}</dd>

        <dt class="text-muted-foreground">Lease / Own</dt>
        <dd class="m-0">{{ props.detail.response.feature.properties.leaseOrOwn ?? "n/a" }}</dd>

        <dt class="text-muted-foreground">Commissioned</dt>
        <dd class="m-0">
          {{ formatNullableMw(props.detail.response.feature.properties.commissionedPowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Available</dt>
        <dd class="m-0">
          {{ formatNullableMw(props.detail.response.feature.properties.availablePowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Under Construction</dt>
        <dd class="m-0">
          {{ formatNullableMw(props.detail.response.feature.properties.underConstructionPowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Planned</dt>
        <dd class="m-0">
          {{ formatNullableMw(props.detail.response.feature.properties.plannedPowerMw) }}
        </dd>
      </dl>
    </template>
  </aside>
</template>
