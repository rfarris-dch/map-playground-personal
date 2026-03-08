import type { SafeParseSchema } from "@map-migration/contracts";
import { Effect, Either } from "effect";
import { apiGetJsonEffect } from "@/lib/api-client-effect";
import { ApiIngestionRunMismatchError, toApiResultFailure } from "@/lib/effect/errors";
import { runBrowserEffect } from "@/lib/effect/runtime";
import type { ApiResult } from "./api-client.types";

export type { ApiResult } from "./api-client.types";

export async function apiGetJson<T>(
  url: string,
  schema: SafeParseSchema<T>,
  init: RequestInit = {},
  options: { requestIdPrefix?: string } = {}
): Promise<ApiResult<T>> {
  const runOptions =
    init.signal == null
      ? undefined
      : {
          signal: init.signal,
        };
  const result = await runBrowserEffect(
    Effect.either(apiGetJsonEffect(url, schema, init, options)),
    runOptions
  );

  if (Either.isRight(result)) {
    return {
      ok: true,
      requestId: result.right.requestId,
      data: result.right.data,
    };
  }

  if (result.left instanceof ApiIngestionRunMismatchError) {
    throw result.left;
  }
  if (typeof result.left === "undefined") {
    throw new Error("apiGetJsonEffect returned an undefined failure.");
  }

  return toApiResultFailure(result.left);
}
