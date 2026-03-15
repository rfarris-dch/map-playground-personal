<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import MapLoadingBar from "@/features/app/components/map-loading-bar.vue";
  import MapStatusBar from "@/features/app/components/map-status-bar.vue";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import FacilityClusterHoverTooltip from "@/features/facilities/components/facility-cluster-hover-tooltip.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import MarketBoundaryHoverTooltip from "@/features/market-boundaries/components/market-boundary-hover-tooltip.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

  const shell = useMapShellContext();

  const parcelDetail = computed(() => shell.parcelDetailQuery.data.value ?? null);
  const isParcelDetailLoading = computed(() => shell.parcelDetailQuery.isLoading.value);
  const isParcelDetailError = computed(() => shell.parcelDetailQuery.isError.value);

  const hasReceivedInitialData = ref(false);
  const isInitialLoading = computed(
    () => !hasReceivedInitialData.value && shell.map.value !== null
  );

  watch(
    () => shell.facilitiesStatus.value,
    (status) => {
      if (hasReceivedInitialData.value) {
        return;
      }
      if (status.colocation.state === "ok" || status.hyperscale.state === "ok") {
        hasReceivedInitialData.value = true;
      }
    },
    { immediate: true }
  );
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
    :county-ids="shell.scannerAnalysisSummary.value?.area?.countyIds"
    :summary="shell.scannerAnalysisSummary.value"
    :is-filtered="shell.scannerIsFiltered.value"
    :is-parcels-loading="shell.isScannerParcelsLoading.value"
    :parcels-error-message="shell.scannerParcelsError.value"
    :empty-message="shell.scannerEmptyMessage.value"
    @close="shell.setScannerActive(false)"
    @export="shell.exportScannerSelection"
    @open-dashboard="shell.openScannerDashboard"
    @select-facility="shell.navigateToFacilityDetail"
  />

  <MapLoadingBar :active="isInitialLoading" />
  <MapStatusBar :overlay-status-message="shell.overlayStatusMessage.value" />

  <FacilityHoverTooltip
    :hover-state="shell.hoveredFacility.value"
    @select="(facilityId, perspective) => shell.navigateToFacilityDetail({ facilityId, perspective: perspective as 'colocation' | 'hyperscale' })"
  />
  <FacilityClusterHoverTooltip
    :hover-state="shell.hoveredFacilityCluster.value"
    @zoom-to-cluster="shell.zoomToCluster"
  />
  <BoundaryHoverTooltip :hover-state="shell.hoveredBoundary.value" />
  <MarketBoundaryHoverTooltip :hover="shell.hoveredMarketBoundary.value" />
  <FiberLocatorHoverTooltip :hover-state="shell.hoveredFiber.value" />
  <PowerHoverTooltip :hover-state="shell.hoveredPower.value" />

  <ParcelDetailDrawer
    :selected-parcel="shell.selectedParcel.value"
    :detail="parcelDetail"
    :is-loading="isParcelDetailLoading"
    :is-error="isParcelDetailError"
    @close="shell.clearSelectedParcel"
  />
</template>
