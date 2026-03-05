import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import FacilitiesColocationPage from "@/pages/facilities-colocation-page.vue";
import FacilitiesHyperscalePage from "@/pages/facilities-hyperscale-page.vue";
import FacilitiesPage from "@/pages/facilities-page.vue";
import MapPage from "@/pages/map-page.vue";
import MarketsPage from "@/pages/markets-page.vue";
import ProvidersPage from "@/pages/providers-page.vue";

const appRoutes: readonly RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/map",
  },
  {
    path: "/map",
    name: "map",
    component: MapPage,
  },
  {
    path: "/markets",
    name: "markets",
    component: MarketsPage,
  },
  {
    path: "/providers",
    name: "providers",
    component: ProvidersPage,
  },
  {
    path: "/facilities",
    name: "facilities",
    component: FacilitiesPage,
    redirect: {
      name: "facilities-hyperscale",
    },
    children: [
      {
        path: "hyperscale",
        name: "facilities-hyperscale",
        component: FacilitiesHyperscalePage,
      },
      {
        path: "colocation",
        name: "facilities-colocation",
        component: FacilitiesColocationPage,
      },
    ],
  },
];

export const appRouter = createRouter({
  history: createWebHistory(),
  routes: [...appRoutes],
});
