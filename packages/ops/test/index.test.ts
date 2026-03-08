import { describe, expect, it, mock } from "bun:test";
import { Effect, Either } from "effect";
import {
  fetchJsonEffect,
  RequestAbortedError,
  RequestHttpError,
  RequestSchemaError,
} from "@/effect";
import {
  createDiagnosticEvent,
  createRequestId,
  normalizeRequestIdHeader,
  REQUEST_ID_MAX_LENGTH,
} from "@/index";

describe("ops request-id helpers", () => {
  it("creates ids with the requested prefix and validates the shared header rules", () => {
    const requestId = createRequestId("web");

    expect(requestId.startsWith("web_")).toBe(true);
    expect(normalizeRequestIdHeader("  req-1  ")).toBe("req-1");
    expect(normalizeRequestIdHeader("bad:id")).toBeNull();
    expect(normalizeRequestIdHeader("a".repeat(REQUEST_ID_MAX_LENGTH + 1))).toBeNull();
  });

  it("creates diagnostic events with stable metadata", () => {
    const event = createDiagnosticEvent("postgis", "TEST_CODE", "diagnostic message", "warning");

    expect(event.code).toBe("TEST_CODE");
    expect(event.message).toBe("diagnostic message");
    expect(event.severity).toBe("warning");
    expect(event.sourceMode).toBe("postgis");
    expect(normalizeRequestIdHeader(event.requestId)).toBe(event.requestId);
    expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
  });
});

describe("ops fetchJsonEffect", () => {
  it("injects request ids, decodes JSON, and preserves the raw body", async () => {
    const fetchMock = mock((input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("/api/health");
      expect(init?.headers instanceof Headers).toBe(true);
      const requestId = (init?.headers as Headers).get("x-request-id");
      expect(normalizeRequestIdHeader(requestId ?? undefined)).toBe(requestId);

      return Promise.resolve(
        new Response(JSON.stringify({ status: "ok" }), {
          headers: {
            "content-type": "application/json",
            "x-request-id": "server-request-1",
          },
          status: 200,
        })
      );
    });

    const result = await Effect.runPromise(
      fetchJsonEffect({
        fetchImplementation: fetchMock as typeof fetch,
        requestIdPrefix: "web",
        schema: {
          safeParse(input) {
            return typeof input === "object" &&
              input !== null &&
              Reflect.get(input, "status") === "ok"
              ? { success: true as const, data: { status: "ok" } }
              : { success: false as const, error: new Error("invalid health payload") };
          },
        },
        url: "/api/health",
      })
    );

    expect(result.requestId).toBe("server-request-1");
    expect(result.data).toEqual({ status: "ok" });
    expect(result.rawBody).toEqual({ status: "ok" });
  });

  it("classifies aborted requests as RequestAbortedError", async () => {
    const fetchMock = mock(() =>
      Promise.reject(new DOMException("The operation was aborted.", "AbortError"))
    );

    const result = await Effect.runPromise(
      Effect.either(
        fetchJsonEffect({
          fetchImplementation: fetchMock as typeof fetch,
          schema: {
            safeParse(input) {
              return { success: true as const, data: input };
            },
          },
          url: "/api/slow",
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) {
      throw new Error("Expected aborted request failure");
    }

    expect(result.left).toBeInstanceOf(RequestAbortedError);
  });

  it("classifies HTTP and schema failures with shared tagged errors", async () => {
    const httpFailure = await Effect.runPromise(
      Effect.either(
        fetchJsonEffect({
          fetchImplementation: mock(() =>
            Promise.resolve(
              new Response(JSON.stringify({ message: "not found" }), {
                headers: {
                  "content-type": "application/json",
                },
                status: 404,
                statusText: "Not Found",
              })
            )
          ) as typeof fetch,
          schema: {
            safeParse(input) {
              return { success: true as const, data: input };
            },
          },
          url: "/api/missing",
        })
      )
    );

    expect(Either.isLeft(httpFailure)).toBe(true);
    if (Either.isRight(httpFailure)) {
      throw new Error("Expected HTTP failure");
    }
    expect(httpFailure.left).toBeInstanceOf(RequestHttpError);

    const schemaFailure = await Effect.runPromise(
      Effect.either(
        fetchJsonEffect({
          fetchImplementation: mock(() =>
            Promise.resolve(
              new Response(JSON.stringify({ status: "unexpected" }), {
                headers: {
                  "content-type": "application/json",
                  "x-request-id": "schema-request-1",
                },
                status: 200,
              })
            )
          ) as typeof fetch,
          schema: {
            safeParse(_input) {
              return { success: false as const, error: new Error("schema mismatch") };
            },
          },
          url: "/api/schema",
        })
      )
    );

    expect(Either.isLeft(schemaFailure)).toBe(true);
    if (Either.isRight(schemaFailure)) {
      throw new Error("Expected schema failure");
    }
    expect(schemaFailure.left).toBeInstanceOf(RequestSchemaError);
  });
});
