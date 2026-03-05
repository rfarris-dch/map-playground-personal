import { describe, expect, it } from "bun:test";
import {
  AnalysisErrorResponseSchema,
  ParcelScoreResponseSchema,
  ProximityResponseSchema,
} from "@/index";

function validMeta(): {
  readonly dataVersion: string;
  readonly generatedAt: string;
  readonly recordCount: number;
  readonly requestId: string;
  readonly sourceMode: "postgis";
  readonly truncated: boolean;
  readonly warnings: readonly [];
} {
  return {
    requestId: "req-123",
    sourceMode: "postgis",
    dataVersion: "dev",
    generatedAt: "2026-03-05T00:00:00.000Z",
    recordCount: 1,
    truncated: false,
    warnings: [],
  };
}

describe("analysis envelope contracts", () => {
  it("accepts score response with shared ResponseMeta envelope", () => {
    const parsed = ParcelScoreResponseSchema.safeParse({
      status: "ok",
      results: [],
      meta: validMeta(),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects score response when shared ResponseMeta is missing", () => {
    const parsed = ParcelScoreResponseSchema.safeParse({
      status: "ok",
      results: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts proximity response with shared ResponseMeta envelope", () => {
    const parsed = ProximityResponseSchema.safeParse({
      status: "ok",
      neighbors: [],
      meta: validMeta(),
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects proximity response when shared ResponseMeta is invalid", () => {
    const parsed = ProximityResponseSchema.safeParse({
      status: "ok",
      neighbors: [],
      meta: {
        ...validMeta(),
        requestId: "",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts shared ApiErrorResponse envelope for analysis errors", () => {
    const parsed = AnalysisErrorResponseSchema.safeParse({
      status: "error",
      requestId: "req-123",
      error: {
        code: "POLICY_REJECTED",
        message: "request policy rejected",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects analysis error without request id", () => {
    const parsed = AnalysisErrorResponseSchema.safeParse({
      status: "error",
      requestId: "",
      error: {
        code: "POLICY_REJECTED",
        message: "request policy rejected",
      },
    });

    expect(parsed.success).toBe(false);
  });
});
