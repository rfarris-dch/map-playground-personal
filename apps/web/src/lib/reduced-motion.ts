import { shallowRef } from "vue";

const query =
  typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)");

export const prefersReducedMotion = shallowRef(query?.matches ?? false);

query?.addEventListener("change", (e) => {
  prefersReducedMotion.value = e.matches;
});
