import {
  createPmtilesSourceUrl as createPmtilesSourceUrlFromManifest,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import { loadTilePublishManifestEffect } from "@map-migration/geo-tiles/effect";
import type { FetchJsonEffectSuccess, RequestEffectError } from "@map-migration/ops/effect";
import { Effect, Either } from "effect";
import { createAbortError } from "@/lib/effect/errors";
import { runBrowserEffect } from "@/lib/effect/runtime";

export async function loadVectorTilePublishManifest(args: {
  readonly contextLabel: string;
  readonly manifestPath: string;
  readonly signal?: AbortSignal;
}): Promise<TilePublishManifest> {
  const runOptions =
    typeof args.signal === "undefined"
      ? undefined
      : {
          signal: args.signal,
        };
  const result: Either.Either<
    FetchJsonEffectSuccess<TilePublishManifest>,
    RequestEffectError
  > = await runBrowserEffect(
    Effect.either(
      loadTilePublishManifestEffect({
        manifestPath: args.manifestPath,
      })
    ),
    runOptions
  );

  if (Either.isRight(result)) {
    return result.right.data;
  }

  const error = result.left;
  switch (error._tag) {
    case "RequestAbortedError":
      throw createAbortError();
    case "RequestNetworkError":
      throw new Error(`[${args.contextLabel}] failed to load tile manifest`);
    case "RequestHttpError":
      throw new Error(
        `[${args.contextLabel}] failed to load tile manifest (${error.status} ${error.statusText})`
      );
    case "RequestJsonParseError":
    case "RequestSchemaError":
      throw new Error(`[${args.contextLabel}] failed to parse tile manifest JSON`);
    default:
      throw error;
  }
}

export function createPmtilesSourceUrl(manifest: TilePublishManifest): string {
  return createPmtilesSourceUrlFromManifest(manifest);
}
