<script setup lang="ts">
  import { computed, ref, shallowRef, watch } from "vue";
  import { useGsapTransition } from "@/composables/use-gsap-transition";
  import MapInitErrorOverlay from "@/features/app/components/map-init-error-overlay.vue";
  import MapLoadingBar from "@/features/app/components/map-loading-bar.vue";
  import MapStatusBar from "@/features/app/components/map-status-bar.vue";
  import { useMapShellContext } from "@/features/app/core/map-shell-context";
  import BoundaryHoverTooltip from "@/features/boundaries/components/boundary-hover-tooltip.vue";
  import CountyPowerStoryDetailDrawer from "@/features/county-power-story/components/county-power-story-detail-drawer.vue";
  import CountyPowerStoryHoverTooltip from "@/features/county-power-story/components/county-power-story-hover-tooltip.vue";
  import FacilityClusterHoverTooltip from "@/features/facilities/components/facility-cluster-hover-tooltip.vue";
  import FacilityClusterSelectedTooltip from "@/features/facilities/components/facility-cluster-selected-tooltip.vue";
  import FacilityHoverTooltip from "@/features/facilities/components/facility-hover-tooltip.vue";
  import FacilitySelectedTooltip from "@/features/facilities/components/facility-selected-tooltip.vue";
  import type {
    FacilityClusterHoverState,
    FacilityHoverState,
  } from "@/features/facilities/hover.types";
  import FiberLocatorHoverTooltip from "@/features/fiber-locator/components/fiber-locator-hover-tooltip.vue";
  import MarketBoundaryHoverTooltip from "@/features/market-boundaries/components/market-boundary-hover-tooltip.vue";
  import ParcelDetailDrawer from "@/features/parcels/parcel-detail/components/parcel-detail-drawer.vue";
  import PowerHoverTooltip from "@/features/power/components/power-hover-tooltip.vue";
  import QuickViewOverlay from "@/features/quick-view/components/quick-view-overlay.vue";
  import ScannerPanel from "@/features/scanner/components/scanner-panel.vue";

  const shell = useMapShellContext();

  const selectedFacilityState = computed<FacilityHoverState | null>(() => {
    const selected = shell.selectedFacility.value;
    if (selected === null) {
      return null;
    }

    const hoveredFacility = shell.hoveredFacility.value;
    if (
      hoveredFacility !== null &&
      hoveredFacility.facilityId === selected.facilityId &&
      hoveredFacility.perspective === selected.perspective
    ) {
      return hoveredFacility;
    }

    const snapshot = shell.selectedFacilityHoverState.value;
    if (
      snapshot !== null &&
      snapshot.facilityId === selected.facilityId &&
      snapshot.perspective === selected.perspective
    ) {
      return snapshot;
    }

    return null;
  });

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
  }

  function handleSelectedViewDetails(facilityId: string, perspective: string): void {
    shell.navigateToFacilityDetail({
      facilityId,
      perspective: perspective as "colocation" | "hyperscale",
    });
  }

  const selectedClusterState = shallowRef<FacilityClusterHoverState | null>(null);

  watch(
    () => shell.clusterClickSignal.value,
    () => {
      const hover = shell.hoveredFacilityCluster.value;
      if (hover !== null) {
        selectedClusterState.value = hover;
        shell.clearSelectedFacility();
      }
    }
  );

  function handleClusterSelectedClose(): void {
    selectedClusterState.value = null;
  }

  function handleClusterZoom(
    perspective: FacilityClusterHoverState["perspective"],
    clusterId: number,
    center: readonly [number, number]
  ): void {
    shell.zoomToCluster(perspective, clusterId, center);
    selectedClusterState.value = null;
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

  const scannerTransition = useGsapTransition({
    enter: { from: { x: 20, opacity: 0 }, duration: 0.3, ease: "power3.out" },
    leave: { to: { x: 16, opacity: 0 }, duration: 0.2, ease: "power2.in" },
  });

  const quickViewTransition = useGsapTransition({
    enter: { from: { opacity: 0, scale: 0.95 }, duration: 0.25, ease: "power2.out" },
    leave: { to: { opacity: 0, scale: 0.95 }, duration: 0.15, ease: "power2.in" },
  });
</script>

<template>
  <Transition
    :css="false"
    @before-enter="quickViewTransition.onBeforeEnter"
    @enter="quickViewTransition.onEnter"
    @leave="quickViewTransition.onLeave"
  >
    <QuickViewOverlay
      v-if="shell.isQuickViewVisible.value"
      :active="shell.isQuickViewVisible.value"
      :facilities="shell.scannerFacilities.value"
      :map="shell.map.value"
      :density-limit="15"
      @object-count="shell.setQuickViewObjectCount"
    />
  </Transition>

  <Transition
    :css="false"
    @before-enter="scannerTransition.onBeforeEnter"
    @enter="scannerTransition.onEnter"
    @leave="scannerTransition.onLeave"
  >
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
  </Transition>

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
    :key="selectedFacilityState.facilityId"
    :state="selectedFacilityState"
    :map="shell.map.value"
    @close="handleSelectedClose"
    @view-details="handleSelectedViewDetails"
  />
  <FacilityClusterHoverTooltip :hover-state="shell.hoveredFacilityCluster.value" />
  <FacilityClusterSelectedTooltip
    v-if="selectedClusterState !== null"
    :state="selectedClusterState"
    @close="handleClusterSelectedClose"
    @zoom-to-cluster="handleClusterZoom"
  />
  <BoundaryHoverTooltip :hover-state="shell.hoveredBoundary.value" />
  <CountyPowerStoryHoverTooltip :hover-state="shell.hoveredCountyPowerStory.value" />
  <MarketBoundaryHoverTooltip :hover="shell.hoveredMarketBoundary.value" />
  <FiberLocatorHoverTooltip :hover-state="shell.hoveredFiber.value" />
  <PowerHoverTooltip :hover-state="shell.hoveredPower.value" />
  <CountyPowerStoryDetailDrawer
    :selected-county="shell.selectedCountyPowerStory.value"
    :detail-row="shell.countyPowerStoryDetailRow.value"
    :is-loading="shell.countyPowerStoryDetailLoading.value"
    :error-message="shell.countyPowerStoryDetailError.value"
    @close="shell.clearSelectedCountyPowerStory"
  />

  <ParcelDetailDrawer
    :selected-parcel="shell.selectedParcel.value"
    :detail="parcelDetail"
    :is-loading="isParcelDetailLoading"
    :is-error="isParcelDetailError"
    :map="shell.map.value"
    @close="shell.clearSelectedParcel"
  />
</template>
