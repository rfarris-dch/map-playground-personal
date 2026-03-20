import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/reduced-motion";

interface GsapTransitionConfig {
  readonly enter?: {
    readonly from: gsap.TweenVars;
    readonly duration?: number;
    readonly ease?: string;
  };
  readonly leave?: {
    readonly to: gsap.TweenVars;
    readonly duration?: number;
    readonly ease?: string;
  };
}

interface GsapTransitionHooks {
  onBeforeEnter: (el: Element) => void;
  onEnter: (el: Element, done: () => void) => void;
  onLeave: (el: Element, done: () => void) => void;
}

export function useGsapTransition(config: GsapTransitionConfig): GsapTransitionHooks {
  const enterFrom = config.enter?.from ?? { opacity: 0 };
  const enterDuration = config.enter?.duration ?? 0.3;
  const enterEase = config.enter?.ease ?? "power3.out";

  const leaveTo = config.leave?.to ?? { opacity: 0 };
  const leaveDuration = config.leave?.duration ?? 0.2;
  const leaveEase = config.leave?.ease ?? "power2.in";

  function onBeforeEnter(el: Element): void {
    gsap.set(el, enterFrom);
  }

  function onEnter(el: Element, done: () => void): void {
    gsap.to(el, {
      ...Object.fromEntries(Object.keys(enterFrom).map((key) => [key, key === "opacity" ? 1 : 0])),
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: prefersReducedMotion.value ? 0 : enterDuration,
      ease: enterEase,
      onComplete: done,
    });
  }

  function onLeave(el: Element, done: () => void): void {
    gsap.to(el, {
      ...leaveTo,
      duration: prefersReducedMotion.value ? 0 : leaveDuration,
      ease: leaveEase,
      onComplete: done,
    });
  }

  return { onBeforeEnter, onEnter, onLeave };
}
