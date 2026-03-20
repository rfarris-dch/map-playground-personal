import { onBeforeUnmount } from "vue";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/reduced-motion";

interface UseGsapTimelineReturn {
  add: (
    target: gsap.TweenTarget,
    vars: gsap.TweenVars,
    position?: gsap.Position
  ) => UseGsapTimelineReturn;
  kill: () => void;
  play: () => void;
  reverse: () => void;
  readonly tl: gsap.core.Timeline;
}

export function useGsapTimeline(defaults?: gsap.TimelineVars): UseGsapTimelineReturn {
  const tl = gsap.timeline({
    paused: true,
    ...defaults,
  });

  function add(
    target: gsap.TweenTarget,
    vars: gsap.TweenVars,
    position?: gsap.Position
  ): UseGsapTimelineReturn {
    const resolvedDuration = prefersReducedMotion.value ? 0 : (vars.duration as number | undefined);
    tl.to(target, { ...vars, duration: resolvedDuration }, position);
    return api;
  }

  function play(): void {
    tl.play();
  }

  function reverse(): void {
    tl.reverse();
  }

  function kill(): void {
    tl.kill();
  }

  onBeforeUnmount(() => {
    tl.kill();
  });

  const api: UseGsapTimelineReturn = { tl, add, play, reverse, kill };
  return api;
}
