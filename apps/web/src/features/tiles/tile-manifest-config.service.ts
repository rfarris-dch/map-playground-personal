function readOptionalString(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function isExternalTileManifestMode(): boolean {
  return readOptionalString(import.meta.env.VITE_TILE_MANIFEST_MODE) === "external";
}

function resolveManifestPath(
  override: string | undefined,
  envValue: string | undefined,
  fallback: string,
  dataset: string
): string {
  const explicitManifestPath = readOptionalString(override) ?? readOptionalString(envValue);
  if (explicitManifestPath !== null) {
    return explicitManifestPath;
  }

  if (isExternalTileManifestMode()) {
    throw new Error(
      `[tiles] missing external manifest URL for ${dataset}; configure the matching VITE_*_MANIFEST_URL value`
    );
  }

  return fallback;
}

export function resolveParcelsManifestPath(manifestPath?: string): string {
  return resolveManifestPath(
    manifestPath,
    import.meta.env.VITE_PARCELS_MANIFEST_URL,
    "/tiles/parcels-draw-v1/latest.json",
    "parcels-draw-v1"
  );
}

export function resolveEnvironmentalFloodManifestPath(manifestPath?: string): string {
  return resolveManifestPath(
    manifestPath,
    import.meta.env.VITE_ENVIRONMENTAL_FLOOD_MANIFEST_URL,
    "/tiles/environmental-flood/latest.json",
    "environmental-flood"
  );
}

export function resolveEnvironmentalHydroBasinsManifestPath(manifestPath?: string): string {
  return resolveManifestPath(
    manifestPath,
    import.meta.env.VITE_ENVIRONMENTAL_HYDRO_BASINS_MANIFEST_URL,
    "/tiles/environmental-hydro-basins/latest.json",
    "environmental-hydro-basins"
  );
}
