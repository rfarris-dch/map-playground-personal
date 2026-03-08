import { describe, expect, it } from "bun:test";
import {
  MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
  type MapContextTransfer,
} from "@map-migration/contracts";
import { createMemoryHistory, createRouter, type LocationQueryRaw } from "vue-router";
import {
  applyMapContextTransferToAppShell,
  buildMapContextTransferQuery,
  inferMapContextSurfaceFromRoute,
  readMapContextTransferFromRoute,
} from "@/features/map-context-transfer/map-context-transfer.service";

const TestPage = {
  template: "<div />",
};

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/map", name: "map", component: TestPage },
      { path: "/markets/:slug/map", name: "market-map", component: TestPage },
      { path: "/companies/:kind/:slug/map", name: "company-map", component: TestPage },
      {
        path: "/dashboard/selection",
        name: "spatial-analysis-dashboard",
        component: TestPage,
      },
    ],
  });
}

function resolveRoute(name: string, query: LocationQueryRaw = {}) {
  let params: Record<string, string> = {};
  if (name === "market-map") {
    params = { slug: "dallas" };
  } else if (name === "company-map") {
    params = { kind: "provider", slug: "acme" };
  }

  return createTestRouter().resolve({
    name,
    params,
    query,
  });
}

describe("map-context-transfer service", () => {
  it("infers scoped route surfaces when the route has no inline context", () => {
    const route = resolveRoute("market-map");

    expect(inferMapContextSurfaceFromRoute(route)).toBe("market-map");
    expect(readMapContextTransferFromRoute({ route })).toEqual({
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "market-map",
    });
  });

  it("merges stored context tokens with inline boundary and viewport query state", () => {
    const storedContext: MapContextTransfer = {
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "market-map",
      marketIds: ["dfw"],
      selectedBoundaryIds: {
        country: ["us"],
        county: ["48113"],
      },
      viewport: {
        type: "center",
        center: [-97.12, 32.81],
        zoom: 8.2,
      },
    };
    const route = resolveRoute("map", {
      mapContextToken: "stored-token",
      stateIds: "tx",
      mapCenter: "-96.797,32.7767",
      mapZoom: "9.5",
    });

    const context = readMapContextTransferFromRoute({
      route,
      store: {
        load(token) {
          return token === "stored-token" ? storedContext : null;
        },
        save() {
          throw new Error("save should not be called while reading context");
        },
      },
    });

    expect(context).toEqual({
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "market-map",
      targetSurface: "global-map",
      contextToken: "stored-token",
      marketIds: ["dfw"],
      selectedBoundaryIds: {
        country: ["us"],
        county: ["48113"],
        state: ["tx"],
      },
      viewport: {
        type: "center",
        center: [-96.797, 32.7767],
        zoom: 9.5,
      },
    });
  });

  it("stores oversized ids in session-backed context tokens and round-trips them", () => {
    const longFacilityIds = [
      "facility-alpha-0001",
      "facility-beta-0002",
      "facility-gamma-0003",
      "facility-delta-0004",
      "facility-epsilon-0005",
      "facility-zeta-0006",
      "facility-eta-0007",
      "facility-theta-0008",
      "facility-iota-0009",
      "facility-kappa-0010",
    ];
    const context: MapContextTransfer = {
      schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
      sourceSurface: "global-map",
      targetSurface: "selection-dashboard",
      facilityIds: longFacilityIds,
      selectedBoundaryIds: {
        state: ["tx"],
      },
    };

    const query = buildMapContextTransferQuery(context, {
      load() {
        return null;
      },
      save(savedContext) {
        expect(savedContext).toEqual(context);
        return "saved-token";
      },
    });

    expect(query.facilityIds).toBeUndefined();
    expect(query.mapContextToken).toBe("saved-token");

    const roundTrip = readMapContextTransferFromRoute({
      route: resolveRoute("spatial-analysis-dashboard", query),
      store: {
        load(token) {
          return token === "saved-token" ? context : null;
        },
        save() {
          throw new Error("save should not be called during round-trip read");
        },
      },
    });

    expect(roundTrip).toEqual({
      ...context,
      contextToken: "saved-token",
      targetSurface: "selection-dashboard",
    });
  });

  it("applies perspective and boundary visibility without changing current UI-side behavior", () => {
    const calls = {
      boundarySelected: [] as Array<{
        readonly boundaryId: string;
        readonly regionIds: readonly string[] | null;
      }>,
      boundaryVisible: [] as Array<{ readonly boundaryId: string; readonly visible: boolean }>,
      perspectiveVisible: [] as Array<{ readonly perspective: string; readonly visible: boolean }>,
    };

    applyMapContextTransferToAppShell({
      context: {
        schemaVersion: MAP_CONTEXT_TRANSFER_SCHEMA_VERSION,
        sourceSurface: "global-map",
        targetSurface: "company-map",
        activePerspectives: ["colocation"],
        selectedBoundaryIds: {
          county: ["48113"],
          state: ["tx"],
        },
      },
      setBoundarySelectedRegionIds(boundaryId, selectedRegionIds) {
        calls.boundarySelected.push({ boundaryId, regionIds: selectedRegionIds });
      },
      setBoundaryVisible(boundaryId, visible) {
        calls.boundaryVisible.push({ boundaryId, visible });
      },
      setPerspectiveVisibility(perspective, visible) {
        calls.perspectiveVisible.push({ perspective, visible });
      },
    });

    expect(calls.perspectiveVisible).toEqual([
      { perspective: "colocation", visible: true },
      { perspective: "hyperscale", visible: false },
    ]);
    expect(calls.boundaryVisible).toEqual([
      { boundaryId: "state", visible: true },
      { boundaryId: "county", visible: true },
    ]);
    expect(calls.boundarySelected).toEqual([
      { boundaryId: "state", regionIds: ["tx"] },
      { boundaryId: "county", regionIds: ["48113"] },
    ]);
  });
});
