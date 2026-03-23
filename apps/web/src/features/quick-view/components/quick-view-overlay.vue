<script setup lang="ts">
  import type { IMap } from "@map-migration/map-engine";
  import { onBeforeUnmount, shallowRef, watch } from "vue";
  import { buildQuickViewLayout } from "@/features/quick-view/quick-view.service";
  import type { QuickViewCard } from "@/features/quick-view/quick-view.types";
  import type { ScannerFacility } from "@/features/scanner/scanner.types";

  interface QuickViewOverlayProps {
    readonly active: boolean;
    readonly densityLimit?: number;
    readonly facilities: readonly ScannerFacility[];
    readonly map: IMap | null;
  }

  const props = defineProps<QuickViewOverlayProps>();

  const emit = defineEmits<{
    objectCount: [count: number];
  }>();

  const cards = shallowRef<readonly QuickViewCard[]>([]);
  const hiddenCount = shallowRef<number>(0);

  let boundMap: IMap | null = null;

  function refreshLayout(): void {
    if (!(props.active && props.map !== null)) {
      cards.value = [];
      hiddenCount.value = 0;
      emit("objectCount", 0);
      return;
    }

    const layout = buildQuickViewLayout({
      map: props.map,
      facilities: props.facilities,
      densityLimit: props.densityLimit ?? 15,
    });

    cards.value = layout.cards;
    hiddenCount.value = layout.hiddenCount;
    emit("objectCount", layout.totalCount);
  }

  const onMapChanged = (): void => {
    refreshLayout();
  };

  function unbindMap(): void {
    if (boundMap === null) {
      return;
    }

    boundMap.off("moveend", onMapChanged);
    boundMap.off("load", onMapChanged);
    boundMap = null;
  }

  function bindMap(nextMap: IMap | null): void {
    unbindMap();

    if (nextMap === null) {
      return;
    }

    boundMap = nextMap;
    nextMap.on("moveend", onMapChanged);
    nextMap.on("load", onMapChanged);
  }

  watch(
    () => props.map,
    (nextMap) => {
      bindMap(nextMap);
      refreshLayout();
    },
    { immediate: true }
  );

  watch(
    () => [props.active, props.densityLimit, props.facilities],
    () => {
      refreshLayout();
    },
    { deep: true }
  );

  onBeforeUnmount(() => {
    unbindMap();
  });

  interface CardMetric {
    readonly label: string;
    readonly value: string;
  }

  function formatCompact(value: number): string {
    if (value >= 100) {
      return Math.round(value).toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function getCardCode(card: QuickViewCard): string | null {
    if (card.facilityName.toLowerCase() === card.providerName.toLowerCase()) {
      return null;
    }
    return card.facilityName;
  }

  function getCardAddress(card: QuickViewCard): string | null {
    const parts: string[] = [];
    if (card.address) {
      parts.push(card.address);
    }
    if (card.city) {
      parts.push(card.city);
    }
    if (card.stateAbbrev) {
      parts.push(card.stateAbbrev);
    }
    return parts.length > 0 ? parts.join(", ") : null;
  }

  function getCardMetrics(card: QuickViewCard): CardMetric[] {
    const result: CardMetric[] = [];
    const isHyperscale = card.perspective === "hyperscale";

    if (card.commissionedPowerMw !== null && card.commissionedPowerMw > 0) {
      result.push({
        label: isHyperscale ? "Own." : "Comm.",
        value: formatCompact(card.commissionedPowerMw),
      });
    }
    if (card.underConstructionPowerMw !== null && card.underConstructionPowerMw > 0) {
      result.push({ label: "UC", value: formatCompact(card.underConstructionPowerMw) });
    }
    if (card.plannedPowerMw !== null && card.plannedPowerMw > 0) {
      result.push({ label: "Plan.", value: formatCompact(card.plannedPowerMw) });
    }
    if (card.availablePowerMw !== null && card.availablePowerMw > 0) {
      result.push({ label: "Avail.", value: formatCompact(card.availablePowerMw) });
    }
    return result;
  }
</script>

<template>
  <div v-if="props.active" class="pointer-events-none absolute inset-0 z-20">
    <div
      v-if="hiddenCount > 0"
      class="map-glass-subtle absolute right-4 top-4 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground"
    >
      Showing top {{ cards.length }} of {{ cards.length + hiddenCount }}
    </div>

    <article
      v-for="card in cards"
      :key="card.id"
      class="absolute flex flex-col gap-1 rounded-[8px] border-2 border-solid bg-white p-2 shadow-md whitespace-nowrap"
      :class="card.perspective === 'colocation' ? 'border-colo-500' : 'border-hyper-500'"
      :style="{
        left: `${card.screenX}px`,
        top: `${card.screenY}px`,
      }"
    >
      <div class="flex items-center gap-2">
        <span
          class="text-[14px] font-semibold leading-none"
          :class="card.perspective === 'colocation' ? 'text-colo-500' : 'text-hyper-500'"
        >
          {{ card.providerName }}
        </span>
        <span v-if="getCardCode(card)" class="text-[11px] font-normal leading-none text-[#94a3b8]">
          {{ getCardCode(card) }}
        </span>
      </div>

      <span v-if="getCardAddress(card)" class="text-[11px] font-normal leading-none text-[#94a3b8]">
        {{ getCardAddress(card) }}
      </span>

      <div v-if="getCardMetrics(card).length > 0" class="flex items-start gap-2">
        <div
          v-for="metric in getCardMetrics(card)"
          :key="metric.label"
          class="flex items-center justify-center gap-1"
        >
          <span class="text-[13px] font-normal leading-none text-[#94a3b8]">
            {{ metric.label }}
          </span>
          <span
            class="text-[13px] font-semibold leading-none"
            :class="card.perspective === 'colocation' ? 'text-colo-500' : 'text-hyper-500'"
          >
            {{ metric.value }}
          </span>
        </div>
      </div>
    </article>
  </div>
</template>
