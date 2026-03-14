interface ReadFeatureSourceLayerNameOptions {
  readonly normalize?: (value: string) => string;
  readonly propertyKey?: string;
}

function toNonEmptyString(value: unknown, normalize?: (value: string) => string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalize ? normalize(value) : value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

export function isFeatureId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

export function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

export function readStringProperty(properties: unknown, key: string): string | null {
  return toNonEmptyString(readProperty(properties, key));
}

export function readNumberProperty(properties: unknown, key: string): number | null {
  const value = readProperty(properties, key);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = toNonEmptyString(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function readNullableNumberProperty(properties: unknown, key: string): number | null {
  return readNumberProperty(properties, key);
}

export function readFirstAvailableString(
  properties: unknown,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = readStringProperty(properties, key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

export function readFeatureSource(feature: { readonly source?: unknown }): string | null {
  return toNonEmptyString(feature.source);
}

export function readFeatureStyleLayerId(feature: { readonly layer?: unknown }): string | null {
  return readStringProperty(feature.layer, "id");
}

export function readFeatureSourceLayerName(
  feature: {
    readonly properties?: unknown;
    readonly sourceLayer?: unknown;
  },
  options: ReadFeatureSourceLayerNameOptions = {}
): string | null {
  const propertyKey = options.propertyKey ?? "layer_name";
  const directSourceLayer = toNonEmptyString(feature.sourceLayer, options.normalize);
  if (directSourceLayer !== null) {
    return directSourceLayer;
  }

  return toNonEmptyString(readProperty(feature.properties, propertyKey), options.normalize);
}

export function readPointCenter(coordinates: unknown): readonly [number, number] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  return [longitude, latitude];
}
