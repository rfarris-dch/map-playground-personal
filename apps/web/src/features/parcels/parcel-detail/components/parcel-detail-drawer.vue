<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import { classifyParcelFloodAttributes } from "@/features/flood/flood-zone-classification.service";
  import { toParcelAttributeEntries } from "@/features/parcels/parcel-detail/detail.service";
  import type { ParcelDetailPayload } from "@/features/parcels/parcel-detail/detail.types";
  import type { SelectedParcelRef } from "@/features/parcels/parcels.types";

  interface ParcelDetailDrawerProps {
    readonly detail: ParcelDetailPayload | null;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly selectedParcel: SelectedParcelRef | null;
  }

  const props = defineProps<ParcelDetailDrawerProps>();

  const emit = defineEmits<{
    close: [];
  }>();

  const attributeEntries = computed(() => {
    const detail = props.detail;
    if (detail === null) {
      return [];
    }

    return toParcelAttributeEntries(detail.response.feature.properties.attrs);
  });
  const floodClassification = computed(() => {
    const detail = props.detail;
    if (detail === null) {
      return null;
    }

    return classifyParcelFloodAttributes(detail.response.feature.properties.attrs);
  });

  function onClose(): void {
    emit("close");
  }
</script>

<template>
  <aside
    v-if="selectedParcel !== null"
    class="map-glass-panel pointer-events-auto absolute right-4 top-4 z-10 w-[min(32rem,calc(100%-2rem))] rounded-lg p-4"
    aria-label="Parcel detail"
  >
    <header class="mb-3 flex items-center gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-tight">Parcel detail</h2>
      <p class="m-0 truncate text-xs font-mono text-muted-foreground">
        {{ selectedParcel.parcelId }}
      </p>
      <Button variant="glass" size="sm" class="ml-auto" @click="onClose">Close</Button>
    </header>

    <p v-if="isLoading" class="m-0 text-xs font-mono text-muted-foreground">Loading detail...</p>
    <p v-else-if="isError" class="m-0 text-xs font-mono text-muted-foreground">
      Parcel detail request failed.
    </p>
    <template v-else-if="detail !== null">
      <dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt class="text-muted-foreground">Request</dt>
        <dd class="m-0 font-mono">{{ detail.requestId }}</dd>

        <dt class="text-muted-foreground">Data version</dt>
        <dd class="m-0 font-mono">{{ detail.response.meta.dataVersion }}</dd>

        <dt class="text-muted-foreground">Source mode</dt>
        <dd class="m-0 font-mono">{{ detail.response.meta.sourceMode }}</dd>

        <dt class="text-muted-foreground">State</dt>
        <dd class="m-0">{{ detail.response.feature.properties.state2 ?? "n/a" }}</dd>

        <dt class="text-muted-foreground">GEOID</dt>
        <dd class="m-0">{{ detail.response.feature.properties.geoid ?? "n/a" }}</dd>

        <dt class="text-muted-foreground">Ingestion run</dt>
        <dd class="m-0 font-mono">{{ detail.response.feature.lineage.ingestionRunId ?? "n/a" }}</dd>
      </dl>

      <section class="map-glass-card mb-3 rounded-md p-3">
        <h3 class="mb-2 mt-0 text-xs font-semibold tracking-wide">Flood context</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          <dt class="text-muted-foreground">Classification</dt>
          <dd class="m-0">{{ floodClassification?.label ?? "Flood zone unavailable" }}</dd>

          <dt class="text-muted-foreground">Zone</dt>
          <dd class="m-0 font-mono">
            {{ floodClassification?.normalizedZone ?? detail.response.feature.properties.attrs.fema_flood_zone ?? "n/a" }}
          </dd>

          <dt class="text-muted-foreground">Subtype</dt>
          <dd class="m-0 font-mono">
            {{ floodClassification?.normalizedZoneSubtype ?? detail.response.feature.properties.attrs.fema_flood_zone_subtype ?? "n/a" }}
          </dd>
        </dl>
      </section>

      <section>
        <h3 class="mb-2 mt-0 text-xs font-semibold tracking-wide">Full Attributes</h3>
        <p class="mb-2 mt-0 text-[11px] text-muted-foreground">
          {{ attributeEntries.length }}
          keys in payload
        </p>
        <div class="map-glass-card max-h-96 overflow-auto rounded-md">
          <table class="w-full border-collapse text-[11px]">
            <thead class="map-glass-panel-soft sticky top-0">
              <tr>
                <th class="px-2 py-1 text-left font-semibold">Field</th>
                <th class="px-2 py-1 text-left font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in attributeEntries"
                :key="entry.key"
                class="border-t border-border/60 align-top"
              >
                <th class="w-48 px-2 py-1 text-left font-mono font-medium">{{ entry.key }}</th>
                <td class="px-2 py-1 font-mono">{{ entry.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </aside>
</template>
