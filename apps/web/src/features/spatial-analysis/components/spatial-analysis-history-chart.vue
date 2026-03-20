<script setup lang="ts">
  import { computed, shallowRef, watch } from "vue";
  import type {
    SpatialAnalysisHistoryModel,
    SpatialAnalysisHistoryPointModel,
    SpatialAnalysisHistorySeriesKey,
  } from "@/features/spatial-analysis/spatial-analysis-history.types";
  import {
    buildSpatialAnalysisHistoryChartModel,
    listDefaultSpatialAnalysisHistorySeries,
    listSpatialAnalysisHistorySeries,
  } from "@/features/spatial-analysis/spatial-analysis-history-chart.service";

  interface SpatialAnalysisHistoryChartProps {
    readonly formatPower: (powerMw: number) => string;
    readonly history: SpatialAnalysisHistoryModel | null;
  }

  const props = defineProps<SpatialAnalysisHistoryChartProps>();

  const activeKeys = shallowRef<readonly SpatialAnalysisHistorySeriesKey[]>(
    listDefaultSpatialAnalysisHistorySeries()
  );
  const selectedTimeSpan = shallowRef<"12q" | "4q" | "8q" | "all">("12q");
  const hoveredPointIndex = shallowRef<number | null>(null);
  const seriesDefinitions = computed(() => listSpatialAnalysisHistorySeries());
  const filteredHistory = computed<SpatialAnalysisHistoryModel | null>(() => {
    const history = props.history;
    if (history === null) {
      return null;
    }

    let pointLimit = Number.POSITIVE_INFINITY;
    if (selectedTimeSpan.value === "4q") {
      pointLimit = 4;
    } else if (selectedTimeSpan.value === "8q") {
      pointLimit = 8;
    } else if (selectedTimeSpan.value === "12q") {
      pointLimit = 12;
    }

    if (pointLimit === Number.POSITIVE_INFINITY || history.points.length <= pointLimit) {
      return history;
    }

    return {
      ...history,
      pointCount: pointLimit,
      points: history.points.slice(-pointLimit),
    };
  });
  const latestPoint = computed(() => {
    const history = filteredHistory.value;
    if (history === null || history.points.length === 0) {
      return null;
    }

    return history.points.at(-1) ?? null;
  });
  const chartModel = computed(() => {
    const history = filteredHistory.value;
    if (history === null) {
      return null;
    }

    return buildSpatialAnalysisHistoryChartModel({
      activeKeys: activeKeys.value,
      history,
    });
  });
  const timeSpanOptions = computed<
    readonly {
      readonly disabled: boolean;
      readonly id: "12q" | "4q" | "8q" | "all";
      readonly label: string;
    }[]
  >(() => {
    const pointCount = props.history?.points.length ?? 0;

    return [
      {
        disabled: pointCount <= 4,
        id: "4q",
        label: "4Q",
      },
      {
        disabled: pointCount <= 8,
        id: "8q",
        label: "8Q",
      },
      {
        disabled: pointCount <= 12,
        id: "12q",
        label: "12Q",
      },
      {
        disabled: pointCount === 0,
        id: "all",
        label: "All",
      },
    ];
  });
  const activeTooltipPoint = computed<SpatialAnalysisHistoryPointModel | null>(() => {
    const history = filteredHistory.value;
    const pointIndex = hoveredPointIndex.value;
    if (history === null || pointIndex === null) {
      return null;
    }

    return history.points[pointIndex] ?? null;
  });
  const activeTooltipPointX = computed<number | null>(() => {
    const chartPoint =
      hoveredPointIndex.value === null ? null : chartModel.value?.points[hoveredPointIndex.value];
    return chartPoint?.x ?? null;
  });
  const activeTooltipRows = computed(() => {
    const point = activeTooltipPoint.value;
    if (point === null) {
      return [];
    }

    return (
      chartModel.value?.lines.map((line) => ({
        color: line.color,
        key: line.key,
        label: line.label,
        value: props.formatPower(point[line.key]),
      })) ?? []
    );
  });
  const activeTooltipLeftStyle = computed(() => {
    const x = activeTooltipPointX.value;
    if (x === null) {
      return null;
    }

    const min = 96;
    const max = 624;
    const clampedX = Math.min(max, Math.max(min, x));
    return {
      left: `${String((clampedX / 720) * 100)}%`,
    };
  });
  const interactiveColumns = computed(() => {
    const points = chartModel.value?.points ?? [];
    if (points.length === 0) {
      return [];
    }

    return points.map((point, index) => {
      const previousX = points[index - 1]?.x ?? 24;
      const nextX = points[index + 1]?.x ?? 696;
      const leftEdge = index === 0 ? 24 : (previousX + point.x) / 2;
      const rightEdge = index === points.length - 1 ? 696 : (point.x + nextX) / 2;
      return {
        index,
        width: rightEdge - leftEdge,
        x: leftEdge,
      };
    });
  });

  function isSeriesActive(key: SpatialAnalysisHistorySeriesKey): boolean {
    return activeKeys.value.includes(key);
  }

  function toggleSeries(key: SpatialAnalysisHistorySeriesKey): void {
    if (activeKeys.value.includes(key)) {
      if (activeKeys.value.length === 1) {
        return;
      }

      activeKeys.value = activeKeys.value.filter((seriesKey) => seriesKey !== key);
      return;
    }

    activeKeys.value = [...activeKeys.value, key];
  }

  function selectTimeSpan(timeSpan: "12q" | "4q" | "8q" | "all"): void {
    selectedTimeSpan.value = timeSpan;
  }

  function setHoveredPointIndex(index: number | null): void {
    hoveredPointIndex.value = index;
  }

  const coverageDetail = computed(() => {
    const history = props.history;
    if (history === null) {
      return null;
    }

    if (history.selectedFacilityCount === 0) {
      return "No selected facilities";
    }

    return `${String(history.includedFacilityCount)} of ${String(history.selectedFacilityCount)} selected facilities have live quarterly history`;
  });

  watch(
    () => filteredHistory.value?.points.length ?? 0,
    (pointCount) => {
      if (pointCount === 0) {
        hoveredPointIndex.value = null;
        return;
      }

      const currentIndex = hoveredPointIndex.value;
      if (currentIndex === null || currentIndex >= pointCount) {
        hoveredPointIndex.value = pointCount - 1;
      }
    },
    {
      immediate: true,
    }
  );
</script>

<template>
  <section class="rounded-sm border border-border bg-background/70 p-3">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-teal-600" />
          <h3 class="m-0 text-xs font-semibold text-muted-foreground">Area History</h3>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          Quarterly live history for facilities currently inside this selection.
        </p>
      </div>
      <div
        v-if="latestPoint !== null"
        class="rounded-sm border border-border bg-card px-2.5 py-1.5 text-right"
      >
        <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Latest Live Quarter
        </div>
        <div class="mt-1 text-sm font-semibold text-foreground/80">
          {{ latestPoint.periodLabel }}
        </div>
      </div>
    </div>

    <div
      v-if="props.history === null || props.history.unavailableReason !== null"
      class="mt-3 rounded-sm border border-dashed border-border bg-card/70 px-3 py-4 text-sm text-muted-foreground"
    >
      {{ props.history?.unavailableReason ?? "History is unavailable for this selection." }}
    </div>

    <template v-else>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <div class="rounded-sm border border-border bg-card p-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Coverage
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/80">
            {{ props.history.coverageStatus }}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">{{ coverageDetail }}</div>
        </div>
        <div class="rounded-sm border border-border bg-card p-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Geometry Basis
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/80">
            {{ props.history.geometryBasis }}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            Current facility locations are used for all periods.
          </div>
        </div>
        <div class="rounded-sm border border-border bg-card p-3">
          <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Leased Overlay
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/80">Unavailable</div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ props.history.leasedOverlayReason }}
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <div class="mr-2 inline-flex rounded-sm border border-border bg-card p-1">
          <button
            v-for="option in timeSpanOptions"
            :key="option.id"
            type="button"
            class="rounded-sm px-2.5 py-1 text-xs font-medium transition-colors"
            :class="
              selectedTimeSpan === option.id
                ? 'bg-background text-foreground/80 shadow-xs'
                : 'text-muted-foreground'
            "
            :disabled="option.disabled"
            @click="selectTimeSpan(option.id)"
          >
            {{ option.label }}
          </button>
        </div>

        <button
          v-for="series in seriesDefinitions"
          :key="series.key"
          type="button"
          class="inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors"
          :class="
            isSeriesActive(series.key)
              ? 'border-border bg-card text-foreground/80'
              : 'border-border bg-background text-muted-foreground'
          "
          @click="toggleSeries(series.key)"
        >
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{ backgroundColor: series.color }"
          />
          {{ series.label }}
        </button>
      </div>

      <div class="relative mt-4 overflow-x-auto">
        <div
          v-if="activeTooltipPoint !== null && activeTooltipLeftStyle !== null"
          class="pointer-events-none absolute top-2 z-10 w-56 -translate-x-1/2 rounded-sm border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
          :style="activeTooltipLeftStyle"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {{ activeTooltipPoint.periodLabel }}
          </div>
          <div class="mt-2 space-y-1.5">
            <div
              v-for="row in activeTooltipRows"
              :key="row.key"
              class="flex items-center justify-between gap-3 text-xs"
            >
              <div class="flex items-center gap-2 text-muted-foreground">
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                {{ row.label }}
              </div>
              <span class="font-medium text-foreground/80">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <svg
          v-if="chartModel !== null"
          viewBox="0 0 720 220"
          class="min-w-[680px]"
          role="img"
          aria-label="Area history chart"
        >
          <g v-for="tick in chartModel.ticks" :key="tick.label">
            <line
              x1="12"
              x2="708"
              :y1="tick.y"
              :y2="tick.y"
              stroke="currentColor"
              class="text-border/70"
              stroke-dasharray="3 4"
            />
            <text
              v-if="tick.axis === 'primary'"
              x="16"
              :y="tick.y - 4"
              class="fill-muted-foreground text-[10px]"
            >
              {{ tick.label }}
            </text>
            <text
              v-else
              x="704"
              :y="tick.y - 4"
              text-anchor="end"
              class="fill-muted-foreground text-[10px]"
            >
              {{ tick.label }}
            </text>
          </g>

          <g v-for="line in chartModel.lines" :key="line.key">
            <path
              :d="line.path"
              fill="none"
              :stroke="line.color"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
            />
            <circle
              v-for="(point, index) in line.points"
              :key="`${line.key}-${chartModel.points[index]?.label ?? index}`"
              :cx="point.x"
              :cy="point.y"
              r="3.5"
              :fill="line.color"
              stroke="white"
              stroke-width="1.5"
            />
          </g>

          <g v-for="point in chartModel.points" :key="point.label">
            <line
              :x1="point.x"
              :x2="point.x"
              y1="192"
              y2="198"
              stroke="currentColor"
              class="text-border"
            />
            <text
              :x="point.x"
              y="214"
              text-anchor="middle"
              class="fill-muted-foreground text-[10px]"
            >
              {{ point.label }}
            </text>
          </g>

          <g v-for="column in interactiveColumns" :key="column.index">
            <rect
              :x="column.x"
              y="12"
              :width="column.width"
              height="180"
              fill="transparent"
              tabindex="0"
              @mouseenter="setHoveredPointIndex(column.index)"
              @focus="setHoveredPointIndex(column.index)"
              @mouseleave="setHoveredPointIndex(null)"
              @blur="setHoveredPointIndex(null)"
            />
          </g>
        </svg>
      </div>

      <div
        v-if="chartModel !== null && chartModel.lines.length > 0"
        class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4"
      >
        <div
          v-for="line in chartModel.lines"
          :key="line.key"
          class="rounded-sm border border-border bg-card px-3 py-2"
        >
          <div
            class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            <span
              class="inline-block h-2 w-2 rounded-full"
              :style="{ backgroundColor: line.color }"
            />
            {{ line.label }}
          </div>
          <div class="mt-1 text-sm font-semibold text-foreground/80">
            {{ props.formatPower(line.valueAtLatestPoint) }}
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
