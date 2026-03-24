<script setup lang="ts">
  import type {
    CountyPowerStoryId,
    CountyPowerStoryWindow,
  } from "@map-migration/http-contracts/county-power-story-http";
  import Switch from "@/components/ui/switch/switch.vue";
  import type { CountyPowerStoryChapterId } from "@/features/county-power-story/county-power-story.types";

  interface CountyPowerStoryChapterOption {
    readonly description: string;
    readonly id: CountyPowerStoryChapterId;
    readonly label: string;
    readonly tone: string;
  }

  interface CountyPowerStoryOption {
    readonly description: string;
    readonly id: CountyPowerStoryWindow;
    readonly label: string;
  }

  interface DockFlyoutCountyPowerStoryProps {
    readonly animationEnabled: boolean;
    readonly chapterId: CountyPowerStoryChapterId;
    readonly chapterVisible: boolean;
    readonly isVisible: boolean;
    readonly seamHazeEnabled: boolean;
    readonly storyId: CountyPowerStoryId;
    readonly threeDimensional: boolean;
    readonly window: CountyPowerStoryWindow;
  }

  const props = defineProps<DockFlyoutCountyPowerStoryProps>();

  const emit = defineEmits<{
    "update:animation-enabled": [enabled: boolean];
    "update:chapter-id": [chapterId: CountyPowerStoryChapterId];
    "update:chapter-visible": [visible: boolean];
    "update:seam-haze-enabled": [enabled: boolean];
    "update:three-dimensional": [enabled: boolean];
    "update:visible": [visible: boolean];
    "update:window": [window: CountyPowerStoryWindow];
  }>();

  const chapterOptions: readonly CountyPowerStoryChapterOption[] = [
    {
      id: "operator-heartbeat",
      label: "Operator Heartbeat",
      description: "Animated market shells and submarket outlines establish market geography.",
      tone: "#2563eb",
    },
    {
      id: "transfer-friction",
      label: "Transfer Friction",
      description: "Transfer ribbons connect market hubs where seams feel easier or tighter.",
      tone: "#f59e0b",
    },
    {
      id: "queue-pressure-storm",
      label: "Queue Pressure Storm",
      description:
        "Heat and hotspot pulses cycle through queue pressure across the current story map.",
      tone: "#8b5cf6",
    },
    {
      id: "transmission-current",
      label: "Transmission Current",
      description:
        "A muted grid base stays on while current rides the strongest backbone corridors.",
      tone: "#f97316",
    },
    {
      id: "policy-shockwaves",
      label: "Policy Shockwaves",
      description: "Policy momentum, event counts, and moratoria radiate as directional pulses.",
      tone: "#ef4444",
    },
    {
      id: "county-scan",
      label: "County Scan Overlay",
      description: "Animated scan patterns dramatize advantaged, watch, and constrained counties.",
      tone: "#0f766e",
    },
  ];

  const windowOptions: readonly CountyPowerStoryOption[] = [
    { id: "live", label: "Live", description: "Current published story snapshot." },
    { id: "30d", label: "30D", description: "Recent changes in the last 30 days." },
    { id: "60d", label: "60D", description: "Recent changes in the last 60 days." },
    { id: "90d", label: "90D", description: "Recent changes in the last 90 days." },
  ];

  function storySummary(storyId: CountyPowerStoryId): string {
    if (storyId === "grid-stress") {
      return "Congestion-first county pulse using RT congestion, negative prices, and shadow price flare.";
    }

    if (storyId === "queue-pressure") {
      return "Queue MW pressure with technology mix and upgrade pressure baked into the county score.";
    }

    if (storyId === "market-structure") {
      return "Wholesale-retail seam context with operator, structure, and seam emphasis.";
    }

    return "Moratorium and sentiment watch mode for counties with elevated local policy friction.";
  }
</script>

<template>
  <div class="flyout-sections flex flex-col">
    <section data-flyout-section class="space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Story Mode
        </div>
        <Switch
          :checked="props.isVisible"
          aria-label="Toggle county power story visibility"
          @update:checked="emit('update:visible', $event)"
        />
      </div>
      <p class="mb-0 text-[11px] leading-relaxed text-muted-foreground">
        {{ storySummary(props.storyId) }}
      </p>
    </section>

    <section data-flyout-section class="space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
          Chapter Overlay
        </div>
        <Switch
          :checked="props.chapterVisible"
          aria-label="Toggle county power story chapter overlay"
          @update:checked="emit('update:chapter-visible', $event)"
        />
      </div>

      <div class="grid gap-1">
        <button
          v-for="option in chapterOptions"
          :key="option.id"
          type="button"
          class="chapter-btn group flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-all"
          :class="
            props.chapterId === option.id
              ? 'is-active bg-foreground/[0.06]'
              : 'hover:bg-foreground/[0.03]'
          "
          @click="emit('update:chapter-id', option.id)"
        >
          <span
            class="mt-[3px] inline-flex size-2 shrink-0 rounded-full ring-2 transition-shadow"
            :class="props.chapterId === option.id ? 'ring-current' : 'ring-transparent'"
            :style="{
              backgroundColor: option.tone,
              color: option.tone,
            }"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <div
              class="text-xs font-semibold transition-colors"
              :class="
                props.chapterId === option.id
                  ? 'text-foreground/90'
                  : 'text-foreground/60 group-hover:text-foreground/80'
              "
            >
              {{ option.label }}
            </div>
            <div
              v-if="props.chapterId === option.id"
              class="mt-0.5 text-[11px] leading-snug text-muted-foreground"
            >
              {{ option.description }}
            </div>
          </div>
        </button>
      </div>
    </section>

    <section data-flyout-section class="space-y-2">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
        Time Window
      </div>
      <div class="grid grid-cols-4 gap-1">
        <button
          v-for="option in windowOptions"
          :key="option.id"
          type="button"
          class="rounded-md px-2 py-1.5 text-center text-xs font-semibold transition-all"
          :class="
            props.window === option.id
              ? 'bg-foreground/10 text-foreground/90 ring-1 ring-foreground/15'
              : 'text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground/70'
          "
          :title="option.description"
          @click="emit('update:window', option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <section data-flyout-section class="space-y-2">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
        Effects
      </div>
      <div class="space-y-1.5">
        <label
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]"
        >
          <span class="text-xs font-medium text-foreground/70">Pulse Animation</span>
          <Switch
            :checked="props.animationEnabled"
            aria-label="Toggle county story animation"
            @update:checked="emit('update:animation-enabled', $event)"
          />
        </label>

        <label
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]"
        >
          <span class="text-xs font-medium text-foreground/70">Seam Haze</span>
          <Switch
            :checked="props.seamHazeEnabled"
            aria-label="Toggle county story seam haze"
            @update:checked="emit('update:seam-haze-enabled', $event)"
          />
        </label>

        <label
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]"
        >
          <span class="text-xs font-medium text-foreground/70">3D Extrusion</span>
          <Switch
            :checked="props.threeDimensional"
            aria-label="Toggle county story 3D mode"
            @update:checked="emit('update:three-dimensional', $event)"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
  .flyout-sections > * {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .flyout-sections > *:first-child {
    padding-top: 0;
  }

  .flyout-sections > *:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .chapter-btn {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
  }

  .chapter-btn.is-active {
    background: rgba(0, 0, 0, 0.04) !important;
  }
</style>
