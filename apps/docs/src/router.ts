import { createRouter, createWebHistory } from "vue-router";

export const docsRouter = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/:slug(.*)*",
      name: "docs-page",
      component: () => import("@/features/docs/pages/docs-page-view.vue"),
    },
  ],
  scrollBehavior(to) {
    if (to.hash.length > 0) {
      return {
        el: to.hash,
        top: 112,
        behavior: "smooth",
      };
    }

    return {
      top: 0,
    };
  },
});
