import {
  type ApiErrorResponse,
  ApiErrorResponseSchema,
  ApiHeaders,
} from "@map-migration/contracts";
import { createRequestId } from "@map-migration/ops";
import type { Context } from "hono";

interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

interface ErrorEnvelopeArgs {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
  readonly requestId: string;
}

interface JsonErrorArgs extends ErrorEnvelopeArgs {
  readonly httpStatus: number;
}

const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

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

export function normalizeRequestIdHeader(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > REQUEST_ID_MAX_LENGTH) {
    return null;
  }

  if (!REQUEST_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getOrCreateRequestId(c: Context, prefix = "api"): string {
  const normalized = normalizeRequestIdHeader(c.req.header(ApiHeaders.requestId));
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
