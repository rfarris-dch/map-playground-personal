import type { FiberLocatorTileFormat } from "@/geo/fiber-locator/fiber-locator.types";

export interface FiberLocatorTilePathRawParams {
  readonly layerNameRaw: string;
  readonly xRaw: string;
  readonly yRaw: string;
  readonly zRaw: string;
}

export interface FiberLocatorTileCoordinates {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface FiberLocatorRouteValidationError {
  readonly code: "INVALID_LAYER_NAME" | "INVALID_TILE_COORDINATES" | "INVALID_TILE_PATH";
  readonly message: string;
}

export type FiberLocatorValidationResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly error: FiberLocatorRouteValidationError;
    };

export interface ProxyFiberLocatorTileRequestArgs {
  readonly format: FiberLocatorTileFormat;
  readonly params: FiberLocatorTilePathRawParams;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}
