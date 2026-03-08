import {
  type ApiErrorResponse,
  ApiErrorResponseSchema,
  ApiHeaders,
  type SafeParseSchema,
} from "@map-migration/contracts";
import {
  createRequestId,
  normalizeRequestIdHeader as normalizeRequestIdHeaderValue,
} from "@map-migration/ops";
import type { Context } from "hono";
import type { ErrorEnvelopeArgs, JsonErrorArgs } from "./api-response.types";

export function normalizeRequestIdHeader(value: string | null | undefined): string | null {
  return normalizeRequestIdHeaderValue(value ?? undefined);
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

export function getOrCreateRequestId(c: Context, prefix = "api"): string {
  const fromContext = c.get("requestId");
  const normalizedFromContext =
    typeof fromContext === "string" ? normalizeRequestIdHeaderValue(fromContext) : null;
  if (typeof normalizedFromContext === "string") {
    return normalizedFromContext;
  }

  const normalized = normalizeRequestIdHeaderValue(c.req.header(ApiHeaders.requestId));
  if (typeof normalized === "string") {
    return normalized;
  }

  return createRequestId(prefix);
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

  return String(error);
}

export function jsonError(c: Context, args: JsonErrorArgs): Response {
  c.header(ApiHeaders.requestId, args.requestId);
  return responseError(args);
}

export function responseError(args: JsonErrorArgs): Response {
  const payload = buildErrorEnvelope(args);
  return Response.json(payload, {
    status: args.httpStatus,
    headers: {
      [ApiHeaders.requestId]: args.requestId,
    },
  });
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

  c.header(ApiHeaders.requestId, requestId);
  return c.json(parsed.data);
}
