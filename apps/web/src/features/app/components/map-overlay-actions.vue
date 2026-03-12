<script setup lang="ts">
  import { Camera, Crosshair, Eye, EyeOff, PenTool, ScanSearch } from "lucide-vue-next";
  import { shallowRef } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import DropdownMenu from "@/components/ui/dropdown-menu/dropdown-menu.vue";
  import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.vue";
  import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.vue";
  import type {
    MapOverlayActionsEmits,
    MapOverlayActionsProps,
  } from "@/features/app/components/map-overlay-actions.types";
  import type { MapViewExportFormat } from "@/features/app/map-export/map-export.types";

  const props = defineProps<MapOverlayActionsProps>();
  const emit = defineEmits<MapOverlayActionsEmits>();
  const isExportMenuOpen = shallowRef(false);

  function triggerMapExport(format: MapViewExportFormat): void {
    isExportMenuOpen.value = false;
    emit("export-map-view", format);
  }
</script>

<template>
  <div class="map-quick-actions pointer-events-auto absolute z-40 flex gap-1.5">
    <DropdownMenu :open="isExportMenuOpen" @update:open="isExportMenuOpen = $event">
      <DropdownMenuTrigger as-child>
        <Button
          size="sm"
          variant="glass"
          :disabled="props.mapExportDisabledReason !== null || props.isMapExporting"
          :title="props.mapExportDisabledReason ?? undefined"
        >
          <Camera class="mr-1.5 h-3.5 w-3.5" />
          {{ props.isMapExporting ? "Exporting..." : "Export" }}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" class="w-56 p-2">
        <p
          class="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Current map view
        </p>
        <div class="grid gap-1">
          <Button size="sm" variant="ghost" class="justify-start" @click="triggerMapExport('png')">
            Download PNG
          </Button>
          <Button size="sm" variant="ghost" class="justify-start" @click="triggerMapExport('jpeg')">
            Download JPEG
          </Button>
          <Button size="sm" variant="ghost" class="justify-start" @click="triggerMapExport('pdf')">
            Download PDF
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>

    <Button
      size="sm"
      :variant="props.quickViewActive ? 'glass-active' : 'glass'"
      :disabled="props.quickViewDisabledReason !== null"
      :title="props.quickViewDisabledReason ?? undefined"
      @click="emit('toggle-quick-view')"
    >
      <EyeOff v-if="props.quickViewActive" class="mr-1.5 h-3.5 w-3.5" />
      <Eye v-else class="mr-1.5 h-3.5 w-3.5" />
      Quick View
      <span class="ml-1 text-[10px] text-muted-foreground">(G)</span>
    </Button>
    <Button
      size="sm"
      :variant="props.sketchMeasureActive ? 'glass-active' : 'glass'"
      @click="emit('toggle-sketch-measure-panel')"
    >
      <PenTool class="mr-1.5 h-3.5 w-3.5" />
      Sketch / Measure
    </Button>
    <Button
      size="sm"
      :variant="props.selectionActive ? 'glass-active' : 'glass'"
      :disabled="props.selectionDisabledReason !== null"
      :title="props.selectionDisabledReason ?? undefined"
      @click="emit('toggle-selection-panel')"
    >
      <Crosshair class="mr-1.5 h-3.5 w-3.5" />
      Selection
    </Button>
    <Button
      size="sm"
      :variant="props.scannerActive ? 'glass-active' : 'glass'"
      :title="props.overlaysBlockedReason ?? undefined"
      @click="emit('toggle-scanner')"
    >
      <ScanSearch class="mr-1.5 h-3.5 w-3.5" />
      Scanner
      <span class="ml-1 text-[10px] text-muted-foreground">(V)</span>
    </Button>
  </div>
</template>
