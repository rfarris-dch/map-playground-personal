<script setup lang="ts">
  import Button from "@/components/ui/button/button.vue";
  import type { SelectedFacilityRef } from "../../facilities.types";
  import { formatNullableMw } from "../detail.service";
  import type { FacilityDetailPayload } from "../detail.types";

  interface FacilityDetailDrawerProps {
    readonly detail: FacilityDetailPayload | null;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly selectedFacility: SelectedFacilityRef | null;
  }

  defineProps<FacilityDetailDrawerProps>();

  const emit = defineEmits<{
    close: [];
  }>();

  function onClose(): void {
    emit("close");
  }
</script>

<template>
  <aside
    v-if="selectedFacility !== null"
    class="pointer-events-auto absolute right-4 top-4 z-10 w-[min(24rem,calc(100%-2rem))] rounded-lg border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-sm"
    aria-label="Facility detail"
  >
    <header class="mb-3 flex items-center gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-tight">
        {{ selectedFacility.perspective }}
        facility
      </h2>
      <p class="m-0 text-xs font-mono text-muted-foreground">{{ selectedFacility.facilityId }}</p>
      <Button variant="ghost" size="sm" class="ml-auto" @click="onClose">Close</Button>
    </header>

    <p v-if="isLoading" class="m-0 text-xs font-mono text-muted-foreground">Loading detail...</p>
    <p v-else-if="isError" class="m-0 text-xs font-mono text-muted-foreground">
      Detail load failed.
    </p>
    <template v-else-if="detail !== null">
      <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt class="text-muted-foreground">Request</dt>
        <dd class="m-0 font-mono">{{ detail.requestId }}</dd>

        <dt class="text-muted-foreground">Provider</dt>
        <dd class="m-0">{{ detail.response.feature.properties.providerId }}</dd>

        <dt class="text-muted-foreground">County FIPS</dt>
        <dd class="m-0">{{ detail.response.feature.properties.countyFips }}</dd>

        <dt class="text-muted-foreground">Semantic</dt>
        <dd class="m-0">{{ detail.response.feature.properties.commissionedSemantic }}</dd>

        <dt class="text-muted-foreground">Lease / Own</dt>
        <dd class="m-0">{{ detail.response.feature.properties.leaseOrOwn ?? "n/a" }}</dd>

        <dt class="text-muted-foreground">Commissioned</dt>
        <dd class="m-0">
          {{ formatNullableMw(detail.response.feature.properties.commissionedPowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Available</dt>
        <dd class="m-0">
          {{ formatNullableMw(detail.response.feature.properties.availablePowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Under Construction</dt>
        <dd class="m-0">
          {{ formatNullableMw(detail.response.feature.properties.underConstructionPowerMw) }}
        </dd>

        <dt class="text-muted-foreground">Planned</dt>
        <dd class="m-0">
          {{ formatNullableMw(detail.response.feature.properties.plannedPowerMw) }}
        </dd>
      </dl>
    </template>
  </aside>
</template>
