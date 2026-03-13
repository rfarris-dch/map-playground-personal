import { describe, expect, it } from "bun:test";
import {
  buildFacilityClusterMarkerModel,
  buildFacilityClusterPowerSegments,
  createFacilityClusterMarkerSignature,
  getFacilityClusterPrimaryLabel,
  readFacilityClusterSummary,
  reconcileFacilityClusterMarkers,
} from "@/features/facilities/facilities-cluster.service";

describe("facilities cluster service", () => {
  it("reads aggregated cluster properties for colocation clusters", () => {
    const summary = readFacilityClusterSummary(
      {
        geometry: {
          type: "Point",
          coordinates: [-96, 32],
        },
        properties: {
          cluster_id: 17,
          point_count: 12,
          commissionedPowerMw: 80,
          underConstructionPowerMw: 30,
          plannedPowerMw: 15,
          availablePowerMw: 18,
        },
      },
      "colocation"
    );

    expect(summary).not.toBeNull();
    expect(summary?.clusterId).toBe(17);
    expect(summary?.facilityCount).toBe(12);
    expect(summary?.commissionedPowerMw).toBe(80);
    expect(summary?.availablePowerMw).toBe(18);
    expect(summary?.totalPowerMw).toBe(125);
  });

  it("uses perspective-specific labels for cluster power segments", () => {
    expect(getFacilityClusterPrimaryLabel("colocation")).toBe("Leased");
    expect(getFacilityClusterPrimaryLabel("hyperscale")).toBe("Operational");

    expect(
      buildFacilityClusterPowerSegments({
        perspective: "colocation",
        commissionedPowerMw: 60,
        underConstructionPowerMw: 20,
        plannedPowerMw: 10,
      }).map((segment) => segment.label)
    ).toEqual(["Leased", "Under Construction", "Planned"]);

    expect(
      buildFacilityClusterPowerSegments({
        perspective: "hyperscale",
        commissionedPowerMw: 90,
        underConstructionPowerMw: 45,
        plannedPowerMw: 30,
      }).map((segment) => segment.label)
    ).toEqual(["Operational", "Under Construction", "Planned"]);
  });

  it("builds marker models with aggregate totals and responsive sizing", () => {
    const markerModel = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96, 32],
        },
        properties: {
          cluster_id: 22,
          point_count: 18,
          commissionedPowerMw: 120,
          underConstructionPowerMw: 50,
          plannedPowerMw: 30,
          availablePowerMw: 16,
        },
      },
      "colocation"
    );

    expect(markerModel).not.toBeNull();
    if (markerModel === null) {
      throw new Error("Expected marker model");
    }

    expect(markerModel.totalPowerMw).toBe(200);
    expect(markerModel.availablePowerMw).toBe(16);
    expect(markerModel.sizePx).toBe(70);
  });

  it("keeps the same marker signature when only the cluster position changes", () => {
    const markerA = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96, 32],
        },
        properties: {
          cluster_id: 22,
          point_count: 18,
          commissionedPowerMw: 120,
          underConstructionPowerMw: 50,
          plannedPowerMw: 30,
          availablePowerMw: 16,
        },
      },
      "colocation"
    );
    const markerB = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-95.8, 32.2],
        },
        properties: {
          cluster_id: 22,
          point_count: 18,
          commissionedPowerMw: 120,
          underConstructionPowerMw: 50,
          plannedPowerMw: 30,
          availablePowerMw: 16,
        },
      },
      "colocation"
    );

    expect(markerA).not.toBeNull();
    expect(markerB).not.toBeNull();
    if (markerA === null || markerB === null) {
      throw new Error("Expected marker models");
    }

    expect(createFacilityClusterMarkerSignature(markerA)).toBe(
      createFacilityClusterMarkerSignature(markerB)
    );
  });

  it("reconciles cluster markers without recreating unchanged clusters", () => {
    const unchangedMarker = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96.2, 32.1],
        },
        properties: {
          cluster_id: 11,
          point_count: 12,
          commissionedPowerMw: 90,
          underConstructionPowerMw: 20,
          plannedPowerMw: 10,
          availablePowerMw: 8,
        },
      },
      "colocation"
    );
    const replacedMarker = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96.5, 32.4],
        },
        properties: {
          cluster_id: 12,
          point_count: 40,
          commissionedPowerMw: 140,
          underConstructionPowerMw: 20,
          plannedPowerMw: 15,
          availablePowerMw: 6,
        },
      },
      "colocation"
    );
    const replacementMarker = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96.45, 32.45],
        },
        properties: {
          cluster_id: 12,
          point_count: 41,
          commissionedPowerMw: 150,
          underConstructionPowerMw: 20,
          plannedPowerMw: 15,
          availablePowerMw: 6,
        },
      },
      "colocation"
    );
    const addedMarker = buildFacilityClusterMarkerModel(
      {
        geometry: {
          type: "Point",
          coordinates: [-96.1, 32.6],
        },
        properties: {
          cluster_id: 13,
          point_count: 9,
          commissionedPowerMw: 45,
          underConstructionPowerMw: 10,
          plannedPowerMw: 5,
          availablePowerMw: 4,
        },
      },
      "colocation"
    );

    expect(unchangedMarker).not.toBeNull();
    expect(replacedMarker).not.toBeNull();
    expect(replacementMarker).not.toBeNull();
    expect(addedMarker).not.toBeNull();
    if (
      unchangedMarker === null ||
      replacedMarker === null ||
      replacementMarker === null ||
      addedMarker === null
    ) {
      throw new Error("Expected marker models");
    }

    const reconciliation = reconcileFacilityClusterMarkers({
      current: new Map([
        [unchangedMarker.clusterId, createFacilityClusterMarkerSignature(unchangedMarker)],
        [replacedMarker.clusterId, createFacilityClusterMarkerSignature(replacedMarker)],
        [99, "obsolete-marker"],
      ]),
      nextModels: [unchangedMarker, replacementMarker, addedMarker],
    });

    expect(reconciliation.moves.map((marker) => marker.clusterId)).toEqual([11]);
    expect(reconciliation.replacements.map((marker) => marker.clusterId)).toEqual([12]);
    expect(reconciliation.additions.map((marker) => marker.clusterId)).toEqual([13]);
    expect(reconciliation.removals).toEqual([99]);
  });
});
