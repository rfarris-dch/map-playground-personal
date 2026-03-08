import { fetchJsonEffect } from "@map-migration/ops/effect";
import {
  decodeTilePublishManifest,
  normalizeManifestPath,
  type TilePublishManifest,
} from "./index";

interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

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
  readonly signal?: AbortSignal;
}

export function loadTilePublishManifestEffect(args: LoadTilePublishManifestEffectArgs) {
  return fetchJsonEffect({
    ...(typeof args.fetchImplementation === "undefined"
      ? {}
      : { fetchImplementation: args.fetchImplementation }),
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
