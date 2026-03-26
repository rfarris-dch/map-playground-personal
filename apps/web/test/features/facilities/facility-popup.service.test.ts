import { describe, expect, it } from "bun:test";
import {
  buildFacilityPopupAddressText,
  buildFacilityPopupCodeText,
} from "@/features/facilities/facility-popup.service";

describe("facility popup service", () => {
  it("returns facility codes when they are present and distinct from the provider name", () => {
    expect(
      buildFacilityPopupCodeText({
        facilityCode: "DFW-2",
        providerName: "Skybox Datacenters",
      })
    ).toBe("DFW-2");
  });

  it("suppresses empty and duplicate facility codes", () => {
    expect(
      buildFacilityPopupCodeText({
        facilityCode: "null",
        providerName: "Skybox Datacenters",
      })
    ).toBeNull();
    expect(
      buildFacilityPopupCodeText({
        facilityCode: "Skybox Datacenters",
        providerName: "Skybox Datacenters",
      })
    ).toBeNull();
  });

  it("builds the second-row address from address fields and falls back to facilityName", () => {
    expect(
      buildFacilityPopupAddressText({
        address: "8375 Dominion Parkway",
        city: "Plano",
        facilityCode: "PLN-1",
        facilityName: "Databank Plano",
        providerName: "Databank",
        stateAbbrev: "TX",
      })
    ).toBe("8375 Dominion Parkway, Plano, TX");

    expect(
      buildFacilityPopupAddressText({
        address: null,
        city: "Plano",
        facilityCode: "PLN-1",
        facilityName: "8375 Dominion Parkway",
        providerName: "Databank",
        stateAbbrev: "TX",
      })
    ).toBe("8375 Dominion Parkway, Plano, TX");
  });
});
