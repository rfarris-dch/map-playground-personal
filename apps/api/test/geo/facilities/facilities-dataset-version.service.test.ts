import { describe, expect, it } from "bun:test";
import {
  readRequestedFacilitiesDatasetVersion,
  readRequestedFacilitiesDatasetVersionForCacheableGet,
} from "@/geo/facilities/route/facilities-dataset-version.service";

describe("facilities dataset version request parsing", () => {
  it("prefers the query value when both query and header are present", () => {
    expect(
      readRequestedFacilitiesDatasetVersion({
        headerValue: "v1",
        queryValue: "v2",
      })
    ).toBe("v2");
  });

  it("allows cacheable GET requests without a pinned dataset version", () => {
    expect(
      readRequestedFacilitiesDatasetVersionForCacheableGet({
        headerValue: null,
        queryValue: null,
      })
    ).toBeNull();
  });

  it("allows cacheable GET requests when header and query match", () => {
    expect(
      readRequestedFacilitiesDatasetVersionForCacheableGet({
        headerValue: "20260323",
        queryValue: "20260323",
      })
    ).toBe("20260323");
  });

  it("rejects cacheable GET requests that only pin the dataset version in a header", () => {
    expect(() =>
      readRequestedFacilitiesDatasetVersionForCacheableGet({
        headerValue: "20260323",
        queryValue: null,
      })
    ).toThrow("cacheable facilities GET requests must include the requested dataset version");
  });

  it("rejects cacheable GET requests when header and query disagree", () => {
    expect(() =>
      readRequestedFacilitiesDatasetVersionForCacheableGet({
        headerValue: "20260323",
        queryValue: "20260324",
      })
    ).toThrow("facilities dataset version header/query mismatch");
  });
});
