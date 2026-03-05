<script setup lang="ts">
  import type { IMap } from "@map-migration/map-engine";
  import { onBeforeUnmount, shallowRef, watch } from "vue";
  import { buildQuickViewLayout } from "@/features/quick-view/quick-view.service";
  import type { QuickViewCard } from "@/features/quick-view/quick-view.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
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
</script>

<template>
  <div v-if="props.active" class="pointer-events-none absolute inset-0 z-20">
    <div
      v-if="hiddenCount > 0"
      class="absolute right-4 top-4 rounded-full border border-border/80 bg-card/95 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow"
    >
      Showing top {{ cards.length }} of {{ cards.length + hiddenCount }}
    </div>

    <article
      v-for="card in cards"
      :key="card.id"
      class="absolute max-w-[190px] rounded-md border border-border/80 bg-card/95 px-2 py-1.5 text-[11px] shadow-lg backdrop-blur-sm"
      :style="{
        left: `${card.screenX}px`,
        top: `${card.screenY}px`,
      }"
    >
      <header class="mb-1 flex items-center gap-1">
        <span
          class="inline-block h-2 w-2 rounded-full"
          :class="card.perspective === 'colocation' ? 'bg-cyan-500' : 'bg-amber-500'"
        />
        <p class="m-0 truncate font-semibold">{{ card.facilityName }}</p>
      </header>
      <p class="m-0 truncate text-muted-foreground">{{ card.providerName }}</p>
      <p class="m-0 mt-1 text-[10px] text-muted-foreground">
        {{ formatScannerPowerMw(card.commissionedPowerMw ?? 0) }}
      </p>
    </article>
  </div>
</template>
