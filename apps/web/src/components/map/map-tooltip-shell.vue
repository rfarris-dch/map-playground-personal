<script setup lang="ts">
  import { toRef, useAttrs } from "vue";
  import { useTooltipPosition } from "@/composables/use-tooltip-position";

  defineOptions({
    inheritAttrs: false,
  });

  interface MapTooltipShellProps {
    readonly ariaLabel: string;
    readonly offset?: {
      readonly x?: number;
      readonly y?: number;
    };
    readonly screenPoint: readonly [number, number] | null;
    readonly show: boolean;
    readonly surfaceClass?: string;
  }

  const props = withDefaults(defineProps<MapTooltipShellProps>(), {
    offset: () => ({
      x: 14,
      y: 14,
    }),
    surfaceClass: "map-glass-surface pointer-events-none absolute z-30 min-w-56 rounded-md p-2",
  });

  const attrs = useAttrs();
  const positionedScreenPoint = toRef(() => {
    return props.show ? props.screenPoint : null;
  });
  const { style: positionStyle } = useTooltipPosition(positionedScreenPoint, props.offset);
</script>

<template>
  <Transition enter-active-class="transition-opacity duration-100" enter-from-class="opacity-0">
    <aside
      v-if="props.show && props.screenPoint !== null"
      v-bind="attrs"
      :class="props.surfaceClass"
      :style="positionStyle"
      :aria-label="props.ariaLabel"
    >
      <slot />
    </aside>
  </Transition>
</template>
