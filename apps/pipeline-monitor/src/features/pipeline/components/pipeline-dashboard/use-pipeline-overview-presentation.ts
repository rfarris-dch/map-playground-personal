import { computed } from "vue";
import type { PipelineDashboardOverviewProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
import {
  formatBuildRate,
  formatEta,
  formatRate,
  formatRowsPerSecondValue,
} from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-format.service";
import { formatCount, formatPhaseLabel } from "@/features/pipeline/pipeline.service";
import { getPipelineDataset } from "@/features/pipeline/pipeline-registry.service";

const BUILD_EXPORT_ELAPSED_PATTERN = /phase=export\s+([0-9]+)s\b/;

interface PipelineOverviewEmit {
  (event: "refreshNow"): void;
  (event: "toggleAutoRefresh", nextChecked: boolean): void;
}

export function usePipelineOverviewPresentation(
  props: PipelineDashboardOverviewProps,
  emit: PipelineOverviewEmit
) {
  const isEnvironmentalDataset = computed(
    () => getPipelineDataset(props.dataset).family === "environmental"
  );

  const isBuilding = computed(() => props.run?.phase === "building");

  const isFloodBuildPreparingExport = computed(() => {
    if (!(isBuilding.value && isEnvironmentalDataset.value)) {
      return false;
    }

    const summary = props.run?.summary ?? "";
    return (
      summary.includes("phase=export") &&
      (props.buildProgress?.workDone ?? 0) === 0 &&
      (props.buildProgress?.logBytes ?? 0) === 0
    );
  });

  const isFloodMaterializing = computed(() => {
    return isEnvironmentalDataset.value && props.dbLoadProgress?.stepKey === "materialize";
  });

  const buildExportElapsedLabel = computed(() => {
    const summary = props.run?.summary ?? "";
    const match = BUILD_EXPORT_ELAPSED_PATTERN.exec(summary);
    if (match === null) {
      return null;
    }

    return `${match[1]}s elapsed`;
  });

  const phaseLabel = computed(() => {
    if (props.run === null) {
      return "Idle";
    }

    if (isEnvironmentalDataset.value && props.run.phase === "extracting") {
      const extractState = props.run.states.find((stateRow) => stateRow.state === "extract");
      const normalizeState = props.run.states.find((stateRow) => stateRow.state === "normalize");

      if (extractState?.isCompleted === true && normalizeState?.isCompleted !== true) {
        return "Normalizing";
      }
    }

    return formatPhaseLabel(props.run.phase, props.dataset, props.run.summary);
  });

  const throughputHeading = computed(() => {
    return isBuilding.value ? "Build Rate" : "Rows Per Second";
  });

  const throughputValue = computed(() => {
    if (isFloodMaterializing.value) {
      return props.dbLoadProgress?.stepLabel ?? "Materializing canonical rows";
    }

    if (isFloodBuildPreparingExport.value) {
      return "Preparing reduced overlay geometry";
    }

    if (isBuilding.value) {
      return formatBuildRate(
        props.buildRateEstimate.percentPerSecond,
        props.buildRateEstimate.rateBasis
      );
    }

    return formatRate(props.rateEstimate.rowsPerSecond, props.rateEstimate.rateBasis);
  });

  const throughputDetails = computed(() => {
    if (isFloodMaterializing.value) {
      return `Current batch: ${props.dbLoadProgress?.currentFile ?? "n/a"}`;
    }

    if (isFloodBuildPreparingExport.value) {
      return buildExportElapsedLabel.value ?? "waiting for first reduced export batch";
    }

    if (isBuilding.value) {
      if (
        props.buildProgress?.workDone !== null &&
        props.buildProgress?.workTotal === null &&
        props.run?.summary?.includes("phase=reduced-export")
      ) {
        return `exported rows: ${formatCount(props.buildProgress.workDone)}`;
      }

      return `recent: ${formatBuildRate(
        props.buildRateEstimate.recentPercentPerSecond,
        "recent"
      )} · avg: ${formatBuildRate(props.buildRateEstimate.averagePercentPerSecond, "average")}`;
    }

    return `recent: ${formatRowsPerSecondValue(props.rateEstimate.recentRowsPerSecond)} · avg: ${formatRowsPerSecondValue(props.rateEstimate.averageRowsPerSecond)}`;
  });

  const remainingHeading = computed(() => {
    return isBuilding.value ? "Build ETA" : "Remaining ETA";
  });

  const remainingValue = computed(() => {
    if (isFloodMaterializing.value) {
      return props.dbLoadPercentLabel;
    }

    if (isFloodBuildPreparingExport.value) {
      return "estimating after first reduced batch";
    }

    if (isBuilding.value) {
      return formatEta(props.buildRateEstimate.etaMs);
    }

    return formatEta(props.rateEstimate.etaMs);
  });

  const remainingDetails = computed(() => {
    if (isFloodMaterializing.value) {
      return `active worker: ${props.dbLoadProgress?.activeWorkers[0] ?? "n/a"}`;
    }

    if (isFloodBuildPreparingExport.value) {
      return "progress becomes measurable after the first reduced overlay rows are emitted";
    }

    if (isBuilding.value) {
      if (
        props.buildProgress?.workDone !== null &&
        props.buildProgress?.workTotal === null &&
        props.run?.summary?.includes("phase=reduced-export")
      ) {
        return "remaining build: estimating after reduced export completes";
      }

      const remainingPercent = props.buildRateEstimate.remainingPercent;
      if (remainingPercent === null) {
        return props.run?.summary ?? "tiles:building";
      }

      return `remaining build: ${remainingPercent.toFixed(2)}%`;
    }

    return `remaining rows: ${props.rateEstimate.remainingRows === null ? "n/a" : formatCount(props.rateEstimate.remainingRows)}`;
  });

  const lastMovementMs = computed(() => {
    if (isBuilding.value) {
      return props.buildRateEstimate.stalledMs ?? props.rateEstimate.stalledMs;
    }

    return props.rateEstimate.stalledMs;
  });

  function onToggleAutoRefresh(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("toggleAutoRefresh", target.checked);
  }

  return {
    isBuilding,
    isEnvironmentalDataset,
    isFloodBuildPreparingExport,
    isFloodMaterializing,
    lastMovementMs,
    onToggleAutoRefresh,
    phaseLabel,
    remainingDetails,
    remainingHeading,
    remainingValue,
    throughputDetails,
    throughputHeading,
    throughputValue,
  };
}
