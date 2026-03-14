<script setup lang="ts">
  import { computed } from "vue";
  import MapStatusBar from "@/features/app/components/map-status-bar.vue";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import FacilityClusterHoverTooltip from "@/features/facilities/components/facility-cluster-hover-tooltip.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import FacilityDetailDrawer from "@/features/facilities/facility-detail/components/facility-detail-drawer.vue";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

  const shell = useMapShellContext();

  const facilityDetail = computed(() => shell.facilityDetailQuery.data.value ?? null);
  const isFacilityDetailLoading = computed(() => shell.facilityDetailQuery.isLoading.value);
  const isFacilityDetailError = computed(() => shell.facilityDetailQuery.isError.value);
  const parcelDetail = computed(() => shell.parcelDetailQuery.data.value ?? null);
  const isParcelDetailLoading = computed(() => shell.parcelDetailQuery.isLoading.value);
  const isParcelDetailError = computed(() => shell.parcelDetailQuery.isError.value);
</script>

<template>
  <QuickViewOverlay
    v-if="shell.isQuickViewVisible.value"
    :active="shell.isQuickViewVisible.value"
    :facilities="shell.scannerFacilities.value"
    :map="shell.map.value"
    :density-limit="15"
    @object-count="shell.setQuickViewObjectCount"
  />

  <ScannerPanel
    v-if="shell.isScannerVisible.value"
    :county-ids="shell.scannerAnalysisSummary.value.area.countyIds"
    :summary="shell.scannerAnalysisSummary.value"
    :is-filtered="shell.scannerIsFiltered.value"
    :is-parcels-loading="shell.isScannerParcelsLoading.value"
    :parcels-error-message="shell.scannerParcelsError.value"
    :empty-message="shell.scannerEmptyMessage.value"
    @close="shell.setScannerActive(false)"
    @export="shell.exportScannerSelection"
    @open-dashboard="shell.openScannerDashboard"
    @select-facility="shell.selectFacilityFromAnalysis"
  />

  <MapStatusBar :overlay-status-message="shell.overlayStatusMessage.value" />

  <FacilityHoverTooltip :hover-state="shell.hoveredFacility.value" />
  <FacilityClusterHoverTooltip
    :hover-state="shell.hoveredFacilityCluster.value"
    @zoom-to-cluster="shell.zoomToCluster"
  />
  <BoundaryHoverTooltip :hover-state="shell.hoveredBoundary.value" />
  <FiberLocatorHoverTooltip :hover-state="shell.hoveredFiber.value" />
  <PowerHoverTooltip :hover-state="shell.hoveredPower.value" />

  <FacilityDetailDrawer
    :selected-facility="shell.selectedFacility.value"
    :detail="facilityDetail"
    :is-loading="isFacilityDetailLoading"
    :is-error="isFacilityDetailError"
    @close="shell.clearSelectedFacility"
  />

  <ParcelDetailDrawer
    :selected-parcel="shell.selectedParcel.value"
    :detail="parcelDetail"
    :is-loading="isParcelDetailLoading"
    :is-error="isParcelDetailError"
    @close="shell.clearSelectedParcel"
  />
</template>
