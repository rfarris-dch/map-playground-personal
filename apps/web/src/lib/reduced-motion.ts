import { shallowRef } from "vue";

const query =
  typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export const prefersReducedMotion = shallowRef(query?.matches ?? false);

query?.addEventListener("change", (e) => {
  prefersReducedMotion.value = e.matches;
});
