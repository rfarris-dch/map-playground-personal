import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { computed, inject, ref } from "vue";
import type { FilterOption } from "@/features/app/components/app-filter-panel.vue";
import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";
import { MAP_FILTERS_KEY } from "@/features/app/filters/map-filters.keys";
import type { TransmissionVoltageFilterId } from "@/features/app/filters/map-filters.types";
import type { BasemapLayerId } from "@/features/basemap/basemap.types";
import type { FacilitiesViewMode } from "@/features/facilities/facilities.types";
import type { FiberLocatorLineId } from "@/features/fiber-locator/fiber-locator.types";
import type { PowerLayerId } from "@/features/power/power.types";
import type {
  MapLayerControlsPanelEmits,
  MapLayerControlsPanelProps,
} from "./map-layer-controls-panel.types";

type MapLayerControlsPanelEmitFn = <K extends keyof MapLayerControlsPanelEmits>(
  event: K,
  ...args: MapLayerControlsPanelEmits[K]
) => void;

export type PanelTab = "layers" | "filters";

const ALL_ZONING_TYPES: readonly FilterOption[] = [
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "industrial", label: "Industrial" },
  { id: "agriculture", label: "Agriculture" },
  { id: "exempt", label: "Exempt" },
  { id: "farmland", label: "Farmland" },
  { id: "mixed", label: "Mixed" },
  { id: "unzoned", label: "Unzoned" },
  { id: "special", label: "Special" },
];

const FLOOD_ZONE_TO_FILTER: Record<string, string> = {
  X: "low-risk",
  C: "low-risk",
  A: "high-risk",
  AE: "high-risk",
  AH: "high-risk",
  AO: "high-risk",
  A99: "high-risk",
  V: "coastal-high-risk",
  VE: "coastal-high-risk",
};

const ALL_FLOOD_ZONES: readonly FilterOption[] = [
  { id: "low-risk", label: "Low Risk" },
  { id: "high-risk", label: "High Risk" },
  { id: "coastal-high-risk", label: "Coastal High Risk" },
];

export function useMapLayerControlsPanelState(
  props: MapLayerControlsPanelProps,
  emit: MapLayerControlsPanelEmitFn
) {
  const mapFilters = inject(MAP_FILTERS_KEY);

  const activeTab = ref<PanelTab>("layers");
  const colocationViewMode = ref<MapNavViewModeId>("clusters");
  const hyperscaleViewMode = ref<MapNavViewModeId>("clusters");
  const fiberExpanded = ref(false);

  /* ------------------------------------------------------------------ */
  /*  Filter panel option arrays                                         */
  /* ------------------------------------------------------------------ */

  const powerTypeOptions: readonly FilterOption[] = [
    { id: "commissioned", label: "Commissioned/Owned" },
    { id: "available", label: "Available (Colo Only)" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
  ];

  const statusOptions: readonly FilterOption[] = [
    { id: "commissioned", label: "Operational/Owned" },
    { id: "under-construction", label: "Under Construction" },
    { id: "planned", label: "Planned" },
    { id: "unknown", label: "Other" },
  ];

  const voltageOptions: readonly FilterOption[] = [
    { id: "ge-25", label: "25 kV+" },
    { id: "ge-50", label: "50 kV+" },
    { id: "ge-100", label: "100 kV+" },
    { id: "ge-230", label: "230 kV+" },
    { id: "ge-765", label: "765 kV+" },
  ];

  const gasCapacityOptions: readonly FilterOption[] = [
    { id: "0-10", label: "0 – 10 BWh" },
    { id: "25-100", label: "25 – 100 BWh" },
    { id: "100-500", label: "100 – 500 BWh" },
    { id: "500-1000", label: "500 – 1,000 BWh" },
    { id: "1000+", label: "1,000+ BWh" },
  ];

  const gasStatusOptions: readonly FilterOption[] = [
    { id: "operating", label: "Operating" },
    { id: "proposed", label: "Proposed" },
    { id: "announced", label: "Announced" },
    { id: "discontinued", label: "Discontinued" },
    { id: "in-development", label: "In Development" },
  ];

  const parcelDatasetOptions: readonly FilterOption[] = [{ id: "", label: "All Datasets" }];
  const parcelStyleOptions: readonly FilterOption[] = [{ id: "", label: "All Sizes" }];
  const parcelDavOptions: readonly FilterOption[] = [{ id: "", label: "Any %" }];

  /* ------------------------------------------------------------------ */
  /*  Computed filter state                                              */
  /* ------------------------------------------------------------------ */

  const zoningTypeOptions = computed<readonly FilterOption[]>(() => {
    const facets = mapFilters?.parcelViewportFacets.value;
    if (!facets || facets.zoningTypes.size === 0) {
      return ALL_ZONING_TYPES;
    }
    const viewportLower = new Set([...facets.zoningTypes].map((z) => z.toLowerCase()));
    return ALL_ZONING_TYPES.filter((opt) => viewportLower.has(opt.id));
  });

  const floodZoneOptions = computed<readonly FilterOption[]>(() => {
    const facets = mapFilters?.parcelViewportFacets.value;
    if (!facets || facets.floodZones.size === 0) {
      return ALL_FLOOD_ZONES;
    }
    const viewportFilterIds = new Set(
      [...facets.floodZones]
        .map((zone) => FLOOD_ZONE_TO_FILTER[zone])
        .filter((id): id is string => id !== undefined)
    );
    return ALL_FLOOD_ZONES.filter((opt) => viewportFilterIds.has(opt.id));
  });

  const marketOptions = computed<readonly FilterOption[]>(
    () => mapFilters?.availableMarkets.value?.map((m) => ({ id: m, label: m })) ?? []
  );

  const providerOptions = computed<readonly FilterOption[]>(
    () => mapFilters?.availableProviders.value?.map((p) => ({ id: p, label: p })) ?? []
  );

  const userOptions = computed<readonly FilterOption[]>(() => []);

  const activeVoltages = computed<ReadonlySet<string>>(() => {
    const v = mapFilters?.state.value?.transmissionMinVoltage ?? null;
    if (v === null) {
      return new Set();
    }
    const entry = voltageOptions.find(
      (opt) =>
        (opt.id === "ge-25" && v === 25_000) ||
        (opt.id === "ge-50" && v === 50_000) ||
        (opt.id === "ge-100" && v === 100_000) ||
        (opt.id === "ge-230" && v === 230_000) ||
        (opt.id === "ge-765" && v === 765_000)
    );
    return entry ? new Set([entry.id]) : new Set();
  });

  const parcelDropdowns = computed(() => ({
    dataset: mapFilters?.state.value?.parcelDataset ?? "",
    styleAcres: mapFilters?.state.value?.parcelStyleAcres ?? "",
    davPercent: mapFilters?.state.value?.parcelDavPercent ?? "",
  }));

  const fiberRoutesVisible = computed(
    () => props.visibleFiberLayers.longhaul || props.visibleFiberLayers.metro
  );

  /* ------------------------------------------------------------------ */
  /*  Color targets                                                      */
  /* ------------------------------------------------------------------ */

  const colorTargets = [
    { id: "water", label: "Water" },
    { id: "road", label: "Roads" },
    { id: "land", label: "Land" },
  ] as const;

  const layerColors = [
    "#ffffcc",
    "#a1dab4",
    "#41b6c4",
    "#2c7fb8",
    "#253494",
    "#fed976",
    "#feb24c",
    "#fd8d3c",
    "#f03b20",
    "#bd0026",
  ] as const;

  /* ------------------------------------------------------------------ */
  /*  Actions                                                            */
  /* ------------------------------------------------------------------ */

  function togglePanel(): void {
    emit("toggle-panel");
  }

  function openAs(tab: PanelTab): void {
    activeTab.value = tab;
    emit("toggle-panel");
  }

  function togglePerspectiveVisibility(perspective: FacilityPerspective): void {
    emit("update:perspective-visibility", perspective, !props.visiblePerspectives[perspective]);
  }

  function setFiberRoutesVisible(visible: boolean): void {
    const lineIds: readonly FiberLocatorLineId[] = ["metro", "longhaul"];
    for (const lineId of lineIds) {
      emit("update:fiber-layer-visibility", lineId, visible);
    }
  }

  function toggleFiberRoutes(): void {
    setFiberRoutesVisible(!fiberRoutesVisible.value);
  }

  function toggleFiberExpanded(): void {
    fiberExpanded.value = !fiberExpanded.value;
  }

  function toggleFiberLine(lineId: FiberLocatorLineId): void {
    emit("update:fiber-layer-visibility", lineId, !props.visibleFiberLayers[lineId]);
  }

  function toggleFiberSourceLayer(lineId: FiberLocatorLineId, layerName: string): void {
    const selected =
      lineId === "metro"
        ? props.selectedFiberSourceLayerNames.metro
        : props.selectedFiberSourceLayerNames.longhaul;
    const isSelected = selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
    emit("toggle-fiber-source-layer", lineId, layerName, !isSelected);
  }

  function isFiberSourceLayerSelected(lineId: FiberLocatorLineId, layerName: string): boolean {
    const selected =
      lineId === "metro"
        ? props.selectedFiberSourceLayerNames.metro
        : props.selectedFiberSourceLayerNames.longhaul;
    return selected.some((n) => n.toLowerCase() === layerName.toLowerCase());
  }

  function togglePowerLayer(layerId: PowerLayerId): void {
    emit("update:power-layer-visible", layerId, !props.powerVisibility[layerId]);
  }

  function toggleParcels(): void {
    emit("update:parcels-visible", !props.parcelsVisible);
  }

  function setColocationViewMode(mode: MapNavViewModeId): void {
    colocationViewMode.value = mode;
    emit("update:perspective-view-mode", "colocation", mode as FacilitiesViewMode);
  }

  function setHyperscaleViewMode(mode: MapNavViewModeId): void {
    hyperscaleViewMode.value = mode;
    emit("update:perspective-view-mode", "hyperscale", mode as FacilitiesViewMode);
  }

  function toggleBasemapLayer(layerId: BasemapLayerId): void {
    emit("update:basemap-layer-visible", layerId, !props.basemapVisibility[layerId]);
  }

  function readTransmissionVoltageFilterId(id: string): TransmissionVoltageFilterId | null {
    switch (id) {
      case "ge-25":
      case "ge-50":
      case "ge-100":
      case "ge-230":
      case "ge-765":
        return id;
      default:
        return null;
    }
  }

  function onToggleVoltage(id: string): void {
    const currentVoltages = activeVoltages.value;
    if (currentVoltages.has(id)) {
      mapFilters?.setTransmissionVoltage(null);
      return;
    }

    const transmissionVoltage = readTransmissionVoltageFilterId(id);
    if (transmissionVoltage !== null) {
      mapFilters?.setTransmissionVoltage(transmissionVoltage);
    }
  }

  function emitBasemapLayerColor(targetId: string, color: string): void {
    emit("update:basemap-layer-color", targetId, color);
  }

  return {
    mapFilters,
    activeTab,
    colocationViewMode,
    hyperscaleViewMode,
    fiberExpanded,
    fiberRoutesVisible,

    // Filter options
    powerTypeOptions,
    statusOptions,
    voltageOptions,
    gasCapacityOptions,
    gasStatusOptions,
    parcelDatasetOptions,
    parcelStyleOptions,
    parcelDavOptions,
    zoningTypeOptions,
    floodZoneOptions,
    marketOptions,
    providerOptions,
    userOptions,
    activeVoltages,
    parcelDropdowns,

    // Color
    colorTargets,
    layerColors,

    // Actions
    togglePanel,
    openAs,
    togglePerspectiveVisibility,
    toggleFiberRoutes,
    toggleFiberExpanded,
    toggleFiberLine,
    toggleFiberSourceLayer,
    isFiberSourceLayerSelected,
    togglePowerLayer,
    toggleParcels,
    setColocationViewMode,
    setHyperscaleViewMode,
    toggleBasemapLayer,
    onToggleVoltage,
    emitBasemapLayerColor,
  };
}
