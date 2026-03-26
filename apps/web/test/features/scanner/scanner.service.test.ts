import { describe, expect, it } from "bun:test";
import { buildScannerSummary } from "@/features/scanner/scanner.service";

describe("scanner service", () => {
  it("counts visible facilities even when county fips is unavailable", () => {
    const summary = buildScannerSummary({
      colocationFeatures: [
        {
          type: "Feature",
          id: "colo:1",
          geometry: {
            type: "Point",
            coordinates: [-96.8, 32.9],
          },
          properties: {
            address: null,
            availablePowerMw: null,
            city: "Carrollton",
            commissionedPowerMw: 12,
            commissionedSemantic: "operational",
            countyFips: null,
            facilityCode: "CRR-1",
            facilityId: "colo:1",
            facilityName: "Visible Facility",
            leaseOrOwn: null,
            perspective: "colocation",
            plannedPowerMw: null,
            providerId: "provider-1",
            providerName: "Provider One",
            squareFootage: null,
            state: null,
            stateAbbrev: "TX",
            statusLabel: null,
            underConstructionPowerMw: null,
          },
        },
      ],
      hyperscaleFeatures: [],
      parcelFeatures: [],
      parcelNextCursor: null,
      parcelTruncated: false,
    });

    expect(summary.totalCount).toBe(1);
    expect(summary.facilities).toHaveLength(1);
    expect(summary.facilities[0]?.countyFips).toBeNull();
    expect(summary.facilities[0]?.facilityCode).toBe("CRR-1");
    expect(summary.countyIds).toEqual([]);
  });
});
