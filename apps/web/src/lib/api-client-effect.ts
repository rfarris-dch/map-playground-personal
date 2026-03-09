import { ApiErrorResponseSchema, ApiHeaders, type SafeParseSchema } from "@map-migration/contracts";
import { type FetchJsonEffectSuccess, fetchJsonEffect } from "@map-migration/ops/effect";
import { Effect } from "effect";
import {
  ApiAbortedError,
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
): Effect.Effect<
  ApiEffectSuccess<TValue>,
  ApiAbortedError | ApiHttpError | ApiNetworkError | ApiPolicyRejectedError | ApiSchemaError,
  never
> {
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
        switch (error._tag) {
          case "RequestAbortedError":
            return Effect.fail(
              new ApiAbortedError({
                requestId: error.requestId,
                details: error.cause,
              })
            );
          case "RequestNetworkError":
            return Effect.fail(
              new ApiNetworkError({
                requestId: error.requestId,
                cause: error.cause,
              })
            );
          case "RequestHttpError": {
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
          case "RequestJsonParseError":
          case "RequestSchemaError":
            return Effect.fail(
              new ApiSchemaError({
                requestId: error.requestId,
                details: error.cause,
              })
            );
          default:
            return Effect.die(error);
        }
      }
    )
  );
}
