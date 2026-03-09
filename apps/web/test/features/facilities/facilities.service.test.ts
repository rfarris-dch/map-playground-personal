import { describe, expect, it } from "bun:test";
import {
  bboxContains,
  expandBbox,
  filterFacilitiesFeaturesToBbox,
  quantizeBbox,
} from "@/features/facilities/facilities.service";

describe("facilities bbox helpers", () => {
  it("pads a viewport bbox so zooming in stays within the fetched coverage", () => {
    const viewportBbox = {
      west: -96,
      south: 29,
      east: -95,
      north: 30,
    };

    const fetchedBbox = quantizeBbox(expandBbox(viewportBbox, 0.5), 3);
    const zoomedInBbox = {
      west: -95.8,
      south: 29.2,
      east: -95.2,
      north: 29.8,
    };

    expect(bboxContains(fetchedBbox, zoomedInBbox)).toBe(true);
  });

  it("does not treat a zoomed-out viewport as covered by the smaller fetched bbox", () => {
    const viewportBbox = {
      west: -96,
      south: 29,
      east: -95,
      north: 30,
    };

    const fetchedBbox = quantizeBbox(expandBbox(viewportBbox, 0.5), 3);
    const zoomedOutBbox = {
      west: -97,
      south: 28,
      east: -94,
      north: 31,
    };

    expect(bboxContains(fetchedBbox, zoomedOutBbox)).toBe(false);
  });

  it("filters cached features back down to the current viewport bbox", () => {
    const features = [
      {
        type: "Feature",
        id: "inside",
        geometry: { type: "Point", coordinates: [-95.5, 29.5] },
        properties: {
          perspective: "colocation",
          facilityId: "inside",
          facilityName: "Inside",
          providerId: "p1",
          providerName: "Provider",
          countyFips: "48201",
          stateAbbrev: "TX",
          commissionedPowerMw: null,
          plannedPowerMw: null,
          underConstructionPowerMw: null,
          availablePowerMw: null,
          squareFootage: null,
          commissionedSemantic: "unknown",
          leaseOrOwn: null,
          statusLabel: null,
          address: null,
          city: null,
          state: null,
        },
      },
      {
        type: "Feature",
        id: "outside",
        geometry: { type: "Point", coordinates: [-94.5, 29.5] },
        properties: {
          perspective: "colocation",
          facilityId: "outside",
          facilityName: "Outside",
          providerId: "p2",
          providerName: "Provider",
          countyFips: "48201",
          stateAbbrev: "TX",
          commissionedPowerMw: null,
          plannedPowerMw: null,
          underConstructionPowerMw: null,
          availablePowerMw: null,
          squareFootage: null,
          commissionedSemantic: "unknown",
          leaseOrOwn: null,
          statusLabel: null,
          address: null,
          city: null,
          state: null,
        },
      },
    ] as const;

    expect(
      filterFacilitiesFeaturesToBbox(features, {
        west: -96,
        south: 29,
        east: -95,
        north: 30,
      }).map((feature) => feature.id)
    ).toEqual(["inside"]);
  });
});
