import type { FiberLocatorTileFormat } from "@/geo/fiber-locator/fiber-locator.types";
import type {
  FiberLocatorTileCoordinates,
  FiberLocatorTilePathRawParams,
  FiberLocatorValidationResult,
} from "@/geo/fiber-locator/route/fiber-locator-route.types";

const FIBER_LOCATOR_LAYER_NAME_RE = /^[a-z0-9._-]+$/i;

function parseTileCoordinate(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseZoom(value: string): number | null {
  const parsed = parseTileCoordinate(value);
  if (parsed === null || parsed > 22) {
    return null;
  }

  return parsed;
}

function normalizeYCoordinateParam(value: string, format: FiberLocatorTileFormat): string | null {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (format === "png" && normalized.endsWith(".png")) {
    return trimmed.slice(0, -4);
  }

  if (format === "pbf" && normalized.endsWith(".pbf")) {
    return trimmed.slice(0, -4);
  }

  return null;
}

export function decodeFiberLocatorPathParam(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseFiberLocatorLayerName(
  layerNameRaw: string
): FiberLocatorValidationResult<string> {
  const layerName = layerNameRaw.trim().toLowerCase();
  if (!FIBER_LOCATOR_LAYER_NAME_RE.test(layerName)) {
    return {
      ok: false,
      error: {
        code: "INVALID_LAYER_NAME",
        message: "layerName contains unsupported characters",
      },
    };
  }

  return {
    ok: true,
    value: layerName,
  };
}

export function parseFiberLocatorTileCoordinates(
  format: FiberLocatorTileFormat,
  params: FiberLocatorTilePathRawParams
): FiberLocatorValidationResult<FiberLocatorTileCoordinates> {
  const z = parseZoom(params.zRaw);
  const x = parseTileCoordinate(params.xRaw);
  const yCoordinate = normalizeYCoordinateParam(params.yRaw, format);
  if (yCoordinate === null) {
    return {
      ok: false,
      error: {
        code: "INVALID_TILE_PATH",
        message: format === "png" ? "tile URL must end with .png" : "tile URL must end with .pbf",
      },
    };
  }

  const y = parseTileCoordinate(yCoordinate);

  if (z === null || x === null || y === null) {
    return {
      ok: false,
      error: {
        code: "INVALID_TILE_COORDINATES",
        message: "tile coordinates must be non-negative integers, with z in range 0..22",
      },
    };
  }

  const tileLimit = 2 ** z;
  if (x >= tileLimit || y >= tileLimit) {
    return {
      ok: false,
      error: {
        code: "INVALID_TILE_COORDINATES",
        message: `x and y must be in range 0..${String(tileLimit - 1)} for z=${String(z)}`,
      },
    };
  }

  return {
    ok: true,
    value: {
      z,
      x,
      y,
    },
  };
}
