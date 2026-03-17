<script setup lang="ts">
  import { computed, ref, shallowRef, watch } from "vue";
  import MapInitErrorOverlay from "@/features/app/components/map-init-error-overlay.vue";
  import MapLoadingBar from "@/features/app/components/map-loading-bar.vue";
  import MapStatusBar from "@/features/app/components/map-status-bar.vue";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import FacilityClusterHoverTooltip from "@/features/facilities/components/facility-cluster-hover-tooltip.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import FacilitySelectedTooltip from "@/features/facilities/components/facility-selected-tooltip.vue";
  import type { FacilityHoverState } from "@/features/facilities/hover.types";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import MarketBoundaryHoverTooltip from "@/features/market-boundaries/components/market-boundary-hover-tooltip.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

  const shell = useMapShellContext();

  const selectedFacilityState = shallowRef<FacilityHoverState | null>(null);

  watch(
    () => shell.selectedFacility.value,
    (next) => {
      if (next === null) {
        selectedFacilityState.value = null;
        return;
      }
      const hover = shell.hoveredFacility.value;
      if (hover !== null && hover.facilityId === next.facilityId) {
        selectedFacilityState.value = hover;
      }
    }
  );

  const suppressedHoverState = computed(() => {
    if (
      selectedFacilityState.value !== null &&
      shell.hoveredFacility.value?.facilityId === selectedFacilityState.value.facilityId
    ) {
      return null;
    }
    return shell.hoveredFacility.value;
  });

  function handleSelectedClose(): void {
    shell.clearSelectedFacility();
    selectedFacilityState.value = null;
  }

  function handleSelectedViewDetails(facilityId: string, perspective: string): void {
    shell.navigateToFacilityDetail({
      facilityId,
      perspective: perspective as "colocation" | "hyperscale",
    });
  }

  const parcelDetail = computed(() => shell.parcelDetailQuery.data.value ?? null);
  const isParcelDetailLoading = computed(() => shell.parcelDetailQuery.isLoading.value);
  const isParcelDetailError = computed(() => shell.parcelDetailQuery.isError.value);

  const hasReceivedInitialData = ref(false);
  const isInitialLoading = computed(
    () => !hasReceivedInitialData.value && shell.map.value !== null
  );

  const mapInitStatus = computed(() => shell.mapInitStatus.value);
  const isMapInitError = computed(() => mapInitStatus.value.phase === "error");
  const isRetrying = computed(() => mapInitStatus.value.phase === "initializing");

  function handleRetry(): void {
    shell.retryMapInitialization();
  }

  watch(
    () => shell.facilitiesStatus.value,
    (status) => {
      if (hasReceivedInitialData.value || status === undefined) {
        return;
      }
      if (status.colocation?.state === "ok" || status.hyperscale?.state === "ok") {
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

  <MapInitErrorOverlay
    v-if="isMapInitError && mapInitStatus.errorReason !== null"
    :error-reason="mapInitStatus.errorReason"
    :retrying="isRetrying"
    @retry="handleRetry"
  />

  <MapLoadingBar :active="isInitialLoading" />
  <MapStatusBar :overlay-status-message="shell.overlayStatusMessage.value" />

  <FacilityHoverTooltip :hover-state="suppressedHoverState" />
  <FacilitySelectedTooltip
    v-if="selectedFacilityState !== null"
    :state="selectedFacilityState"
    :map="shell.map.value"
    @close="handleSelectedClose"
    @view-details="handleSelectedViewDetails"
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
