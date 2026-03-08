import { ApiErrorResponseSchema, ApiHeaders, type SafeParseSchema } from "@map-migration/contracts";
import {
  type FetchJsonEffectSuccess,
  fetchJsonEffect,
  isRequestEffectError,
} from "@map-migration/ops/effect";
import { Effect } from "effect";
import {
  ApiAbortedError,
  type ApiEffectError,
  ApiHttpError,
  ApiNetworkError,
  ApiPolicyRejectedError,
  ApiSchemaError,
} from "@/lib/effect/errors";

export interface ParsedApiError {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
  readonly requestId: string;
}

export interface ApiEffectSuccess<TValue> {
  readonly data: TValue;
  readonly requestId: string;
}

function parseApiError(details: unknown): ParsedApiError | null {
  const parsed = ApiErrorResponseSchema.safeParse(details);
  if (!parsed.success) {
    return null;
  }

  return {
    requestId: parsed.data.requestId,
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    details: parsed.data.error.details,
  };
}

export function apiGetJsonEffect<TValue>(
  url: string,
  schema: SafeParseSchema<TValue>,
  init: RequestInit = {},
  options: { requestIdPrefix?: string } = {}
): Effect.Effect<ApiEffectSuccess<TValue>, Exclude<ApiEffectError, never>, never> {
  return fetchJsonEffect({
    init,
    requestIdHeaderName: ApiHeaders.requestId,
    requestIdPrefix: options.requestIdPrefix ?? "web",
    schema,
    url,
  }).pipe(
    Effect.map(
      (result: FetchJsonEffectSuccess<TValue>) =>
        ({
          requestId: result.requestId,
          data: result.data,
        }) satisfies ApiEffectSuccess<TValue>
    ),
    Effect.catchAll(
      (
        error
      ): Effect.Effect<
        never,
        ApiAbortedError | ApiHttpError | ApiNetworkError | ApiPolicyRejectedError | ApiSchemaError,
        never
      > => {
        if (!isRequestEffectError(error)) {
          return Effect.die(error);
        }

        if (error._tag === "RequestAbortedError") {
          return Effect.fail(
            new ApiAbortedError({
              requestId: error.requestId,
              details: error.cause,
            })
          );
        }

        if (error._tag === "RequestNetworkError") {
          return Effect.fail(
            new ApiNetworkError({
              requestId: error.requestId,
              cause: error.cause,
            })
          );
        }

        if (error._tag === "RequestHttpError") {
          const apiError = parseApiError(error.details);
          if (apiError !== null) {
            if (apiError.code === "POLICY_REJECTED") {
              return Effect.fail(
                new ApiPolicyRejectedError({
                  requestId: apiError.requestId,
                  status: error.status,
                  code: apiError.code,
                  message: apiError.message,
                  details: apiError.details,
                })
              );
            }

            return Effect.fail(
              new ApiHttpError({
                requestId: apiError.requestId,
                status: error.status,
                code: apiError.code,
                message: apiError.message,
                details: apiError.details,
              })
            );
          }

          return Effect.fail(
            new ApiHttpError({
              requestId: error.requestId,
              status: error.status,
              details: error.details,
            })
          );
        }

        if (error._tag === "RequestJsonParseError" || error._tag === "RequestSchemaError") {
          return Effect.fail(
            new ApiSchemaError({
              requestId: error.requestId,
              details: error.cause,
            })
          );
        }

        return Effect.die(error);
      }
    )
  );
}
