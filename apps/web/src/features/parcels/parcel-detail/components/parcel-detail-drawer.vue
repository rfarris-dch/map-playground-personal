<script setup lang="ts">
  import { computed } from "vue";
  import EntityDetailDrawerShell from "@/components/map/entity-detail-drawer-shell.vue";
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
</script>

<template>
  <EntityDetailDrawerShell
    ariaLabel="Parcel detail"
    :selected="props.selectedParcel"
    eyebrow="Parcel detail"
    :title="props.selectedParcel?.parcelId ?? 'Parcel detail'"
    :is-loading="props.isLoading"
    :is-error="props.isError"
    loading-message="Loading parcel detail..."
    error-message="Parcel detail failed to load. Try selecting the parcel again."
    @close="emit('close')"
  >
    <template v-if="props.detail !== null">
      <dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <dt class="text-xs text-muted-foreground">State</dt>
        <dd class="m-0 text-sm">{{ props.detail.response.feature.properties.state2 ?? "n/a" }}</dd>

        <dt class="text-xs text-muted-foreground">GEOID</dt>
        <dd class="m-0 text-sm">{{ props.detail.response.feature.properties.geoid ?? "n/a" }}</dd>

      </dl>

      <section class="mb-3 border-t border-border/50 pt-3">
        <h3 class="mb-2 mt-0 text-xs font-semibold tracking-wide">Flood context</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
          <dt class="text-xs text-muted-foreground">Classification</dt>
          <dd class="m-0 text-sm">{{ floodClassification?.label ?? "Flood zone unavailable" }}</dd>

          <dt class="text-xs text-muted-foreground">Zone</dt>
          <dd class="m-0 text-sm font-mono">
            {{ floodClassification?.normalizedZone ?? props.detail.response.feature.properties.attrs.fema_flood_zone ?? "n/a" }}
          </dd>

          <dt class="text-xs text-muted-foreground">Subtype</dt>
          <dd class="m-0 text-sm font-mono">
            {{ floodClassification?.normalizedZoneSubtype ?? props.detail.response.feature.properties.attrs.fema_flood_zone_subtype ?? "n/a" }}
          </dd>
        </dl>
      </section>

      <section class="border-t border-border/50 pt-3">
        <h3 class="mb-2 mt-0 text-xs font-semibold tracking-wide">Full Attributes</h3>
        <p class="mb-2 mt-0 text-xs text-muted-foreground">
          {{ attributeEntries.length }}
          keys in payload
        </p>
        <div class="max-h-96 overflow-auto rounded-md border border-border/40">
          <table class="w-full border-collapse text-xs">
            <thead class="sticky top-0 bg-background/95">
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
  </EntityDetailDrawerShell>
</template>
