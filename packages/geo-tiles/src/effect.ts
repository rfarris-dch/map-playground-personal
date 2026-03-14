import {
  createAbortError,
  type FetchJsonEffectSuccess,
  fetchJsonEffect,
  type RequestEffectError,
  runEffectPromise,
  type SafeParseSchema,
} from "@map-migration/core-runtime/effect";
import { either } from "effect/Effect";
import { type Either, isRight } from "effect/Either";
import {
  decodeTilePublishManifest,
  normalizeManifestPath,
  type TilePublishManifest,
} from "./index";

const tilePublishManifestSchema: SafeParseSchema<TilePublishManifest> = {
  safeParse(input) {
    const decoded = decodeTilePublishManifest(input);
    return decoded.ok
      ? { success: true, data: decoded.value }
      : { success: false, error: new Error(decoded.message) };
  },
};

export interface LoadTilePublishManifestEffectArgs {
  readonly contextLabel?: string;
  readonly fetchImplementation?: typeof fetch;
  readonly manifestPath: string;
  readonly preserveNetworkErrorCause?: boolean;
  readonly signal?: AbortSignal;
}

export function loadTilePublishManifestEffect(args: LoadTilePublishManifestEffectArgs) {
  return fetchJsonEffect({
    ...(typeof args.fetchImplementation === "undefined"
      ? {}
      : { fetchImplementation: args.fetchImplementation }),
    includeRequestIdHeader: false,
    init: {
      headers: {
        accept: "application/json",
      },
      method: "GET",
      ...(typeof args.signal === "undefined" ? {} : { signal: args.signal }),
    },
    requestIdPrefix: "tiles",
    schema: tilePublishManifestSchema,
    url: normalizeManifestPath(args.manifestPath),
  });
}

export async function loadTilePublishManifest(
  args: LoadTilePublishManifestEffectArgs
): Promise<TilePublishManifest> {
  const result: Either<
    FetchJsonEffectSuccess<TilePublishManifest>,
    RequestEffectError
  > = await runEffectPromise(either(loadTilePublishManifestEffect(args)), args.signal);

  if (isRight(result)) {
    return result.right.data;
  }

  const contextLabel =
    typeof args.contextLabel === "string" && args.contextLabel.trim().length > 0
      ? `[${args.contextLabel}] `
      : "";

  switch (result.left._tag) {
    case "RequestAbortedError":
      throw createAbortError("The operation was aborted.");
    case "RequestNetworkError":
      if (args.preserveNetworkErrorCause === true) {
        throw result.left.cause;
      }

      throw new Error(`${contextLabel}failed to load tile manifest`);
    case "RequestHttpError":
      throw new Error(
        `${contextLabel}failed to load tile manifest (${result.left.status} ${result.left.statusText})`
      );
    case "RequestJsonParseError":
    case "RequestSchemaError":
      throw new Error(`${contextLabel}failed to parse tile manifest JSON`);
    default:
      throw result.left;
  }
}
