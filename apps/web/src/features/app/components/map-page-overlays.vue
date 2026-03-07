<script setup lang="ts">
  import type {
    MapPageOverlaysEmits,
    MapPageOverlaysProps,
  } from "@/features/app/components/map-page-overlays.types";
  import MapStatusBar from "@/features/app/components/map-status-bar.vue";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import FacilityDetailDrawer from "@/features/facilities/facility-detail/components/facility-detail-drawer.vue";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

  const props = defineProps<MapPageOverlaysProps>();

  const emit = defineEmits<MapPageOverlaysEmits>();

  function forwardQuickViewObjectCount(count: number): void {
    emit("quick-view-object-count", count);
  }

  function forwardSelectedFacility(facility: SelectedFacilityRef): void {
    emit("select-facility", facility);
  }
</script>

<template>
  <QuickViewOverlay
    v-if="props.isQuickViewVisible"
    :active="props.isQuickViewVisible"
    :facilities="props.scannerFacilities"
    :map="props.map"
    :density-limit="15"
    @object-count="forwardQuickViewObjectCount"
  />

  <ScannerPanel
    v-if="props.isScannerVisible"
    :summary="props.scannerSummary"
    :is-filtered="props.scannerIsFiltered"
    :is-parcels-loading="props.isScannerParcelsLoading"
    :parcels-error-message="props.scannerParcelsError"
    :empty-message="props.scannerEmptyMessage"
    @close="emit('close-scanner')"
    @export="emit('export-scanner-selection')"
    @open-dashboard="emit('open-scanner-dashboard')"
    @select-facility="forwardSelectedFacility"
  />

  <MapStatusBar :overlay-status-message="props.overlayStatusMessage" />

  <FacilityHoverTooltip :hover-state="props.hoveredFacility" />
  <BoundaryHoverTooltip :hover-state="props.hoveredBoundary" />
  <FiberLocatorHoverTooltip :hover-state="props.hoveredFiber" />
  <PowerHoverTooltip :hover-state="props.hoveredPower" />

  <FacilityDetailDrawer
    :selected-facility="props.selectedFacility"
    :detail="props.facilityDetail"
    :is-loading="props.isFacilityDetailLoading"
    :is-error="props.isFacilityDetailError"
    @close="emit('close-facility-detail')"
  />

  <ParcelDetailDrawer
    :selected-parcel="props.selectedParcel"
    :detail="props.parcelDetail"
    :is-loading="props.isParcelDetailLoading"
    :is-error="props.isParcelDetailError"
    @close="emit('close-parcel-detail')"
  />
</template>
