import { describe, expect, it } from "bun:test";
import { normalizeRequestIdHeader } from "@/http/api-response";

describe("request id normalization", () => {
  it("accepts safe request ids", () => {
    expect(normalizeRequestIdHeader("abc-123._XYZ")).toBe("abc-123._XYZ");
    expect(normalizeRequestIdHeader("  req-1  ")).toBe("req-1");
  });

  it("rejects empty, oversized, or unsafe values", () => {
    expect(normalizeRequestIdHeader("")).toBeNull();
    expect(normalizeRequestIdHeader(" ".repeat(8))).toBeNull();
    expect(normalizeRequestIdHeader("a".repeat(129))).toBeNull();
    expect(normalizeRequestIdHeader("bad:id")).toBeNull();
    expect(normalizeRequestIdHeader("bad/id")).toBeNull();
  });
});
