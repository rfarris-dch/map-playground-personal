import {
  createPmtilesSourceUrl as createPmtilesSourceUrlFromManifest,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import { loadTilePublishManifestEffect } from "@map-migration/geo-tiles/effect";
import {
  RequestAbortedError,
  RequestHttpError,
  RequestJsonParseError,
  RequestNetworkError,
  RequestSchemaError,
} from "@map-migration/ops/effect";
import { Effect, Either } from "effect";
import { createAbortError } from "@/features/app/runtime-effect/errors";

export async function loadVectorTilePublishManifest(args: {
  readonly contextLabel: string;
  readonly manifestPath: string;
  readonly signal?: AbortSignal;
}): Promise<TilePublishManifest> {
  const result = await Effect.runPromise(
    Effect.either(
      loadTilePublishManifestEffect({
        contextLabel: args.contextLabel,
        manifestPath: args.manifestPath,
        ...(typeof args.signal === "undefined" ? {} : { signal: args.signal }),
      })
    )
  );

  if (Either.isRight(result)) {
    return result.right.data;
  }

  const error = result.left;
  if (error instanceof RequestAbortedError) {
    throw createAbortError();
  }
  if (error instanceof RequestNetworkError) {
    throw new Error(`[${args.contextLabel}] failed to load tile manifest`);
  }
  if (error instanceof RequestHttpError) {
    throw new Error(
      `[${args.contextLabel}] failed to load tile manifest (${error.status} ${error.statusText})`
    );
  }
  if (error instanceof RequestJsonParseError || error instanceof RequestSchemaError) {
    throw new Error(`[${args.contextLabel}] failed to parse tile manifest JSON`);
  }

  throw error;
}

export function createPmtilesSourceUrl(manifest: TilePublishManifest): string {
  return createPmtilesSourceUrlFromManifest(manifest);
}
