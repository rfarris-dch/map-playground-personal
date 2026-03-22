import {
  createRequestId,
  normalizeRequestIdHeader as normalizeRequestIdHeaderValue,
} from "@map-migration/core-runtime";
import type { SafeParseSchema } from "@map-migration/core-runtime/effect";
import {
  type ApiErrorResponse,
  ApiErrorResponseSchema,
} from "@map-migration/http-contracts/api-error";
import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import type { Context } from "hono";
import type { ErrorEnvelopeArgs, JsonErrorArgs } from "./api-response.types";

export function normalizeRequestIdHeader(value: string | null | undefined): string | null {
  return normalizeRequestIdHeaderValue(value ?? undefined);
}

export function resolveRequestId(c: Context, prefix = "api"): string {
  const fromContext = c.get("requestId");
  const normalizedFromContext =
    typeof fromContext === "string" ? normalizeRequestIdHeaderValue(fromContext) : null;
  if (typeof normalizedFromContext === "string") {
    return normalizedFromContext;
  }

  return createRequestId(prefix);
}

function buildErrorEnvelope(args: ErrorEnvelopeArgs): ApiErrorResponse {
  const candidate: ApiErrorResponse = {
    status: "error",
    requestId: args.requestId,
    error: {
      code: args.code,
      message: args.message,
    },
  };

  if (typeof args.category === "string") {
    candidate.error.category = args.category;
  }
  if (typeof args.subtype === "string") {
    candidate.error.subtype = args.subtype;
  }
  if (typeof args.details !== "undefined") {
    candidate.error.details = args.details;
  }

  const parsed = ApiErrorResponseSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    status: "error",
    requestId: args.requestId,
    error: {
      code: "INTERNAL_ERROR_ENVELOPE_INVALID",
      message: "internal server error",
    },
  };
}

export function toDebugDetails(error: unknown): unknown {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (
    error === null ||
    typeof error === "boolean" ||
    typeof error === "number" ||
    typeof error === "string"
  ) {
    return error;
  }

  if (typeof error === "bigint") {
    return error.toString();
  }

  if (Array.isArray(error)) {
    return error.map((value) => toDebugDetails(value));
  }

  if (typeof error === "object") {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return Object.fromEntries(
        Object.entries(error).map(([key, value]) => [key, toDebugDetails(value)])
      );
    }
  }

  return String(error);
}

export function withRequestId(response: Response, requestId: string): Response {
  response.headers.set(ApiHeaders.requestId, requestId);
  return response;
}

export function withHeaders(
  response: Response,
  headers: Readonly<Record<string, string | undefined>>
): Response {
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string" && value.length > 0) {
      response.headers.set(name, value);
    }
  }

  return response;
}

export function jsonError(_c: Context, args: JsonErrorArgs): Response {
  return responseError(args);
}

export function responseError(args: JsonErrorArgs): Response {
  const payload = buildErrorEnvelope(args);
  return withRequestId(
    Response.json(payload, {
      status: args.httpStatus,
    }),
    args.requestId
  );
}

export function jsonOk<T>(
  c: Context,
  schema: SafeParseSchema<T>,
  payload: unknown,
  requestId: string
): Response {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(c, {
      requestId,
      httpStatus: 500,
      code: "RESPONSE_CONTRACT_VIOLATION",
      message: "response payload failed contract validation",
      details: toDebugDetails(parsed.error),
    });
  }

  return withRequestId(c.json(parsed.data), requestId);
}
