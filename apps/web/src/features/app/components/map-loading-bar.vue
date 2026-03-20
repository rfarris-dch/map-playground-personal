<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from "vue";
  import { useGsapTransition } from "@/composables/use-gsap-transition";
  import { gsap } from "@/lib/gsap";
  import { prefersReducedMotion } from "@/lib/reduced-motion";

  interface MapLoadingBarProps {
    readonly active: boolean;
  }

  const props = defineProps<MapLoadingBarProps>();

  const indicatorRef = ref<HTMLElement | null>(null);
  let slideTween: gsap.core.Tween | null = null;

  const barTransition = useGsapTransition({
    enter: { from: { opacity: 0 }, duration: 0.3, ease: "power2.out" },
    leave: { to: { opacity: 0 }, duration: 0.5, ease: "power2.in" },
  });

  function startSlide(): void {
    const el = indicatorRef.value;
    if (el === null) {
      return;
    }
    slideTween?.kill();
    if (prefersReducedMotion.value) {
      gsap.set(el, { xPercent: 0 });
      return;
    }
    slideTween = gsap.fromTo(
      el,
      { xPercent: -100 },
      { xPercent: 350, duration: 1.2, ease: "power1.inOut", repeat: -1 }
    );
  }

  watch(
    () => props.active,
    (active) => {
      if (active) {
        requestAnimationFrame(startSlide);
      } else {
        slideTween?.kill();
        slideTween = null;
      }
    }
  );

  onBeforeUnmount(() => {
    slideTween?.kill();
  });
</script>

<template>
  <Transition
    :css="false"
    @before-enter="barTransition.onBeforeEnter"
    @enter="(el, done) => { barTransition.onEnter(el, done); startSlide(); }"
    @leave="barTransition.onLeave"
  >
    <div v-if="active" class="pointer-events-none absolute inset-x-0 top-0 z-40">
      <div class="h-[2px] w-full bg-transparent">
        <div ref="indicatorRef" class="h-full w-[40%] rounded-full bg-primary/70" />
      </div>
    </div>
  </Transition>
</template>
