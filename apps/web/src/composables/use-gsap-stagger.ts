import type { ComputedRef, Ref } from "vue";
import { onBeforeUnmount } from "vue";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/reduced-motion";

interface UseGsapStaggerOptions {
  readonly container: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>;
  readonly duration?: number;
  readonly ease?: string;
  readonly from?: gsap.TweenVars;
  readonly selector: string;
  readonly stagger?: number;
}

interface UseGsapStaggerReturn {
  animate: () => void;
}

export function useGsapStagger(options: UseGsapStaggerOptions): UseGsapStaggerReturn {
  const stagger = options.stagger ?? 0.04;
  const duration = options.duration ?? 0.25;
  const ease = options.ease ?? "power2.out";
  const from = options.from ?? { opacity: 0, y: 12 };

  let tween: gsap.core.Tween | null = null;

  function animate(): void {
    const el = options.container.value;
    if (el === null) {
      return;
    }
    const children = el.querySelectorAll(options.selector);
    if (children.length === 0) {
      return;
    }

    tween?.kill();
    gsap.set(children, from);
    tween = gsap.to(children, {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: prefersReducedMotion.value ? 0 : duration,
      ease,
      stagger: prefersReducedMotion.value ? 0 : stagger,
    });
  }

  onBeforeUnmount(() => {
    tween?.kill();
  });

  return { animate };
}
