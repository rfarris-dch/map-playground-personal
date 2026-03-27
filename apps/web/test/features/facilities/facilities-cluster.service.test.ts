import { describe, expect, it } from "bun:test";
import {
  buildFacilityClusterPowerSegments,
  getFacilityClusterPrimaryLabel,
  readFacilityClusterSummary,
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
});
