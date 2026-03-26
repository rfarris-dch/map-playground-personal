import type { ApiRouteError, ApiRouteErrorArgs } from "@/http/effect-route";
import { routeError } from "@/http/effect-route";

/**
 * A single production-safe validation issue extracted from a Zod error.
 *
 * Contains only the field path, Zod issue code, and human-readable message.
 * Stacks, internal state, and debug blobs are intentionally excluded so this
 * is safe to return in any environment.
 */
interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

/**
 * Extracts production-safe validation issues from a Zod-like error.
 *
 * Accepts any value so callers never need to narrow or cast. If the value
 * has an `issues` array (like `ZodError`), each issue's `path`, `code`, and
 * `message` are extracted. Otherwise returns an empty array.
 */
function extractValidationIssues(error: unknown): readonly ValidationIssue[] {
  if (
    error === null ||
    error === undefined ||
    typeof error !== "object" ||
    !("issues" in error) ||
    !Array.isArray(error.issues)
  ) {
    return [];
  }

  return error.issues.map((issue: unknown): ValidationIssue => {
    if (issue === null || issue === undefined || typeof issue !== "object") {
      return { path: [], code: "unknown", message: "unknown validation issue" };
    }

    const issuePath =
      "path" in issue && Array.isArray(issue.path)
        ? issue.path.filter(
            (segment: unknown): segment is string | number =>
              typeof segment === "string" || typeof segment === "number"
          )
        : [];

    const code = "code" in issue && typeof issue.code === "string" ? issue.code : "unknown";

    const message =
      "message" in issue && typeof issue.message === "string"
        ? issue.message
        : "unknown validation issue";

    return { path: issuePath, code, message };
  });
}

/**
 * Builds a standardized validation `ApiRouteError` from a failed `safeParse` result.
 *
 * Every route that validates request input with Zod should use this instead of
 * constructing ad-hoc `routeError` / `rejectWithBadRequest` calls so that the
 * 400 response always carries the same shape:
 *
 * ```json
 * {
 *   "status": "error",
 *   "requestId": "...",
 *   "error": {
 *     "code": "BAD_REQUEST",
 *     "message": "human-readable summary",
 *     "details": {
 *       "issues": [{ "path": ["aoi","type"], "code": "invalid_enum_value", "message": "..." }]
 *     }
 *   }
 * }
 * ```
 */
export function validationRouteError(args: {
  readonly code?: string;
  readonly message: string;
  readonly zodError: unknown;
}): ApiRouteError {
  const issues = extractValidationIssues(args.zodError);
  const errorArgs: ApiRouteErrorArgs = {
    httpStatus: 400,
    code: args.code ?? "BAD_REQUEST",
    message: args.message,
    details: { issues },
  };
  return routeError(errorArgs);
}
