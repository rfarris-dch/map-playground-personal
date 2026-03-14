import type { Context } from "hono";
import { jsonError, toDebugDetails } from "@/http/api-response";
import type { ReadJsonBodyArgs, ReadJsonBodyResult } from "./json-request.service.types";

export type { ReadJsonBodyResult } from "./json-request.service.types";

const JSON_CONTENT_TYPE_RE = /^application\/([a-z-+.]+\+)?json(\s*;.*)?$/i;
const PAYLOAD_TOO_LARGE_RE = /payload too large/i;

function isBodyLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === "BodyLimitError" || PAYLOAD_TOO_LARGE_RE.test(error.message);
  }

  return false;
}

export async function readJsonBody(
  c: Context,
  args: ReadJsonBodyArgs
): Promise<ReadJsonBodyResult> {
  const contentType = c.req.header("content-type");
  if (typeof contentType !== "string" || !JSON_CONTENT_TYPE_RE.test(contentType)) {
    return {
      ok: false,
      response: jsonError(c, {
        requestId: args.requestId,
        httpStatus: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "content-type must be application/json",
      }),
    };
  }

  let bodyText = "";
  try {
    bodyText = await c.req.text();
  } catch (error) {
    if (isBodyLimitError(error)) {
      return {
        ok: false,
        response: jsonError(c, {
          requestId: args.requestId,
          httpStatus: 413,
          code: "REQUEST_BODY_TOO_LARGE",
          message: "request body exceeds configured limit",
        }),
      };
    }

    return {
      ok: false,
      response: jsonError(c, {
        requestId: args.requestId,
        httpStatus: 400,
        code: "BAD_REQUEST",
        message: args.invalidJsonMessage,
        details: toDebugDetails(error),
      }),
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(bodyText),
    };
  } catch {
    return {
      ok: false,
      response: jsonError(c, {
        requestId: args.requestId,
        httpStatus: 400,
        code: "BAD_REQUEST",
        message: args.invalidJsonMessage,
      }),
    };
  }
}
