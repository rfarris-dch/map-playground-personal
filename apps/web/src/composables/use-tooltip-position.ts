import { computed, type Ref } from "vue";

export function useTooltipPosition(
  screenPoint: Ref<readonly [number, number] | null>,
  offset: { x?: number; y?: number } = {}
) {
  const style = computed(() => {
    if (!screenPoint.value) return { display: "none" as const };
    return {
      left: `${screenPoint.value[0] + (offset.x ?? 14)}px`,
      top: `${screenPoint.value[1] + (offset.y ?? 14)}px`,
    };
  });

  return { style };
}
