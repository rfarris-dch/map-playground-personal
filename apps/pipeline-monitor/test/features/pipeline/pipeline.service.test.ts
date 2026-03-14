import { afterEach, describe, expect, it, mock } from "bun:test";
import { ApiHeaders, buildPipelineStatusRoute } from "@map-migration/http-contracts/api-routes";
import { getPipelineDatasetDescriptor, PIPELINE_PLATFORM } from "@map-migration/http-contracts/pipeline-http";
import { Effect } from "effect";
import {
  createFetchPipelineStatusEffect,
  fetchPipelineStatus,
} from "../../../src/features/pipeline/pipeline.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createSuccessResponseBody(): Record<string, unknown> {
  return {
    dataset: getPipelineDatasetDescriptor("parcels"),
    status: "ok",
    generatedAt: "2026-03-08T12:00:00.000Z",
    enabled: true,
    mode: "external",
    intervalMs: 3000,
    requireStartupSuccess: true,
    snapshotRoot: "/tmp/parcels-sync",
    latestRunId: "run-1",
    latestRunCompletedAt: null,
    platform: PIPELINE_PLATFORM,
    run: {
      runId: "run-1",
      reason: "interval",
      phase: "extracting",
      isRunning: true,
      startedAt: "2026-03-08T12:00:00.000Z",
      endedAt: null,
      durationMs: null,
      exitCode: null,
      summary: null,
      progress: {
        schemaVersion: 1,
        phase: "extracting",
      },
      states: [
        {
          state: "extract",
          expectedCount: 100,
          writtenCount: 100,
          pagesFetched: 4,
          lastSourceId: 10,
          updatedAt: "2026-03-08T12:00:01.000Z",
          isCompleted: true,
        },
      ],
      statesCompleted: 1,
      statesTotal: 1,
      writtenCount: 100,
      expectedCount: 100,
      logTail: [],
    },
  };
}

describe("fetchPipelineStatus", () => {
  it("maps network failures and keeps the generated request-id header", async () => {
    let capturedRequestId = "";

    globalThis.fetch = mock((_, init?: RequestInit) => {
      capturedRequestId = new Headers(init?.headers).get(ApiHeaders.requestId) ?? "";
      return Promise.reject(new Error("socket hang up"));
    });

    const result = await fetchPipelineStatus("parcels");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a failed fetch result");
    }

    expect(capturedRequestId.length).toBeGreaterThan(0);
    expect(result.error.reason).toBe("network");
    expect(result.error.requestId).toBe(capturedRequestId);
    expect(result.error.message).toBe("Network request failed");
  });

  it("maps abort failures and keeps the generated request-id header", async () => {
    let capturedRequestId = "";

    globalThis.fetch = mock((_, init?: RequestInit) => {
      capturedRequestId = new Headers(init?.headers).get(ApiHeaders.requestId) ?? "";
      return Promise.reject(new DOMException("Request aborted", "AbortError"));
    });

    const result = await fetchPipelineStatus("parcels");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an aborted fetch result");
    }

    expect(capturedRequestId.length).toBeGreaterThan(0);
    expect(result.error.reason).toBe("aborted");
    expect(result.error.requestId).toBe(capturedRequestId);
    expect(result.error.message).toBe("Request aborted");
  });

  it("maps http failures, reads response details, and uses the response request-id", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "upstream unavailable" }), {
          headers: {
            [ApiHeaders.requestId]: "req-http",
            "content-type": "application/json",
          },
          status: 503,
          statusText: "Service Unavailable",
        })
      )
    );

    const result = await fetchPipelineStatus("parcels");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an http fetch result");
    }

    expect(result.error.reason).toBe("http");
    expect(result.error.requestId).toBe("req-http");
    expect(result.error.status).toBe(503);
    expect(result.error.message).toBe("HTTP 503 Service Unavailable");
    expect(result.error.details).toEqual({
      error: "upstream unavailable",
    });
  });

  it("maps invalid json bodies to schema failures while preserving the response request-id", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("{", {
          headers: {
            [ApiHeaders.requestId]: "req-schema",
            "content-type": "application/json",
          },
          status: 200,
        })
      )
    );

    const result = await fetchPipelineStatus("parcels");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a schema fetch result");
    }

    expect(result.error.reason).toBe("schema");
    expect(result.error.requestId).toBe("req-schema");
    expect(result.error.message).toBe("Response JSON parsing failed");
  });

  it("keeps raw-state completion flags on successful responses", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(createSuccessResponseBody()), {
          headers: {
            [ApiHeaders.requestId]: "req-success",
            "content-type": "application/json",
          },
          status: 200,
        })
      )
    );

    const result = await fetchPipelineStatus("parcels");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful fetch result");
    }

    expect(result.payload.requestId).toBe("req-success");
    expect(result.payload.response.run.states[0]?.isCompleted).toBe(true);
  });

  it("targets the generic pipeline route for flood monitor requests", async () => {
    let capturedUrl = "";

    globalThis.fetch = mock((input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return Promise.resolve(
        new Response(JSON.stringify(createSuccessResponseBody()), {
          headers: {
            [ApiHeaders.requestId]: "req-flood",
            "content-type": "application/json",
          },
          status: 200,
        })
      );
    });

    const result = await Effect.runPromise(createFetchPipelineStatusEffect("flood"));

    expect(result.ok).toBe(true);
    expect(capturedUrl).toBe(buildPipelineStatusRoute("flood"));
  });
});
