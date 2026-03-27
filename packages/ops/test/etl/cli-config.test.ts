import { describe, expect, it } from "bun:test";
import { findCliArgValue } from "../../src/etl/cli-config";

describe("findCliArgValue", () => {
  it("reads equals-style flags", () => {
    expect(findCliArgValue(["--mode=strict"], "--mode")).toBe("strict");
  });

  it("reads space-delimited flags", () => {
    expect(findCliArgValue(["--mode", "strict"], "--mode")).toBe("strict");
  });

  it("ignores a following flag when no value is provided", () => {
    expect(findCliArgValue(["--mode", "--surface=county"], "--mode")).toBeNull();
  });
});
