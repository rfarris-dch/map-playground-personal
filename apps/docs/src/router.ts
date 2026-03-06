import { createRouter, createWebHistory } from "vue-router";
import DocsPageView from "@/features/docs/pages/docs-page-view.vue";

export const docsRouter = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/:slug(.*)*",
      name: "docs-page",
      component: DocsPageView,
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
