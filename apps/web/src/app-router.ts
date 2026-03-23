import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import FacilitiesColocationPage from "@/pages/facilities-colocation-page.vue";
import FacilitiesHyperscalePage from "@/pages/facilities-hyperscale-page.vue";
import FacilitiesPage from "@/pages/facilities-page.vue";
import LoginPage from "@/pages/login-page.vue";
import MapPage from "@/pages/map-page.vue";
import MarketsPage from "@/pages/markets-page.vue";
import NotFoundPage from "@/pages/not-found-page.vue";
import ProvidersPage from "@/pages/providers-page.vue";
import SpatialAnalysisDashboardPage from "@/pages/spatial-analysis-dashboard-page.vue";

const appRoutes: readonly RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/map",
  },
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: {
      public: true,
    },
  },
  {
    path: "/map",
    name: "map",
    component: MapPage,
    meta: {
      navigationId: "map",
    },
  },
  {
    path: "/markets/:marketSlug/map",
    name: "market-map",
    component: MapPage,
    meta: {
      navigationId: "map",
    },
  },
  {
    path: "/companies/:companyKind/:companySlug/map",
    name: "company-map",
    component: MapPage,
    meta: {
      navigationId: "map",
    },
  },
  {
    path: "/dashboard/selection",
    name: "spatial-analysis-dashboard",
    component: SpatialAnalysisDashboardPage,
  },
  {
    path: "/markets",
    name: "markets",
    component: MarketsPage,
    meta: {
      navigationId: "markets",
    },
  },
  {
    path: "/providers",
    name: "providers",
    component: ProvidersPage,
    meta: {
      navigationId: "providers",
    },
  },
  {
    path: "/facilities/:perspective/:facilityId",
    name: "facility-detail",
    component: () => import("@/pages/facility-detail-page.vue"),
    meta: {
      navigationId: "facilities",
    },
  },
  {
    path: "/providers/:providerId",
    name: "provider-detail",
    component: () => import("@/pages/provider-detail-page.vue"),
    meta: {
      navigationId: "providers",
    },
  },
  {
    path: "/facilities",
    name: "facilities",
    component: FacilitiesPage,
    meta: {
      navigationId: "facilities",
    },
    redirect: {
      name: "facilities-hyperscale",
    },
    children: [
      {
        path: "hyperscale",
        name: "facilities-hyperscale",
        component: FacilitiesHyperscalePage,
        meta: {
          navigationId: "facilities",
        },
      },
      {
        path: "colocation",
        name: "facilities-colocation",
        component: FacilitiesColocationPage,
        meta: {
          navigationId: "facilities",
        },
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: NotFoundPage,
  },
];

export const appRouter = createRouter({
  history: createWebHistory(),
  routes: [...appRoutes],
});

function readRedirectQueryValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

appRouter.beforeEach(async (to) => {
  const { ensureMapAppAuthSessionLoaded } = await import("@/features/auth/auth-session.service");
  const session = await ensureMapAppAuthSessionLoaded();
  const isPublicRoute = to.meta.public === true;

  if (session === null) {
    if (isPublicRoute) {
      return true;
    }

    return {
      name: "login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (isPublicRoute) {
    return readRedirectQueryValue(to.query.redirect) ?? "/map";
  }

  return true;
});
