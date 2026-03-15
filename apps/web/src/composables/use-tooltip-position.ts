import { computed, type Ref, ref } from "vue";

export function useTooltipPosition(
  screenPoint: Ref<readonly [number, number] | null>,
  offset: { x?: number; y?: number } = {},
  tooltipSize: { width?: number; height?: number } = {}
) {
  const tooltipRef = ref<HTMLElement | null>(null);

  const style = computed(() => {
    if (!screenPoint.value) {
      return { display: "none" as const };
    }

    const ox = offset.x ?? 14;
    const oy = offset.y ?? 14;
    const [cx, cy] = screenPoint.value;

    const tw = tooltipRef.value?.offsetWidth ?? tooltipSize.width ?? 280;
    const th = tooltipRef.value?.offsetHeight ?? tooltipSize.height ?? 160;

    const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
    const vh = typeof window !== "undefined" ? window.innerHeight : 1080;

    const left = cx + ox + tw > vw ? cx - ox - tw : cx + ox;
    const top = cy + oy + th > vh ? cy - oy - th : cy + oy;

    return {
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`,
    };
  });

  return { style, tooltipRef };
}
