const SFHA_ZONE_CODES = new Set(["A", "AE", "AH", "AO", "AR", "A99", "V", "VE"]);

interface FloodZoneClassification {
  readonly isFlood100: boolean;
  readonly isFlood500: boolean;
  readonly label: string;
  readonly legendKey: "flood-100" | "flood-500" | "other";
  readonly normalizedZone: string | null;
  readonly normalizedZoneSubtype: string | null;
}

function floodLegendLabel(legendKey: "flood-100" | "flood-500"): string {
  if (legendKey === "flood-100") {
    return "100-year floodplain (1% annual chance / SFHA)";
  }

  return "500-year floodplain (0.2% annual chance)";
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeZone(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized === null) {
    return null;
  }

  return normalized.toUpperCase();
}

function normalizeZoneSubtype(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized === null) {
    return null;
  }

  return normalized.toUpperCase();
}

function readSfhaFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "T" || normalized === "TRUE" || normalized === "Y") {
    return true;
  }

  if (normalized === "F" || normalized === "FALSE" || normalized === "N") {
    return false;
  }

  return null;
}

function isStrict500YearZone(zone: string | null, zoneSubtype: string | null): boolean {
  if (zone !== "X") {
    return false;
  }

  if (zoneSubtype === null) {
    return false;
  }

  return zoneSubtype.includes("0.2") || zoneSubtype.includes("0.2 PCT");
}

function describeOtherZone(zone: string | null, zoneSubtype: string | null): string {
  if (zone === null && zoneSubtype === null) {
    return "Flood zone unavailable";
  }

  if (zone !== null && zoneSubtype !== null) {
    return `FEMA zone ${zone} (${zoneSubtype.toLowerCase()})`;
  }

  if (zone !== null) {
    return `FEMA zone ${zone}`;
  }

  return `FEMA flood subtype ${zoneSubtype?.toLowerCase() ?? "unavailable"}`;
}

function classifyFloodZone(
  input: Readonly<{
    sfhaTf?: unknown;
    zone?: unknown;
    zoneSubtype?: unknown;
  }>
): FloodZoneClassification {
  const normalizedZone = normalizeZone(input.zone);
  const normalizedZoneSubtype = normalizeZoneSubtype(input.zoneSubtype);
  const sfhaTf = readSfhaFlag(input.sfhaTf);
  const isFlood100 = sfhaTf === true || SFHA_ZONE_CODES.has(normalizedZone ?? "");
  const isFlood500 = !isFlood100 && isStrict500YearZone(normalizedZone, normalizedZoneSubtype);

  if (isFlood100) {
    return {
      isFlood100: true,
      isFlood500: false,
      label: floodLegendLabel("flood-100"),
      legendKey: "flood-100",
      normalizedZone,
      normalizedZoneSubtype,
    };
  }

  if (isFlood500) {
    return {
      isFlood100: false,
      isFlood500: true,
      label: floodLegendLabel("flood-500"),
      legendKey: "flood-500",
      normalizedZone,
      normalizedZoneSubtype,
    };
  }

  return {
    isFlood100: false,
    isFlood500: false,
    label: describeOtherZone(normalizedZone, normalizedZoneSubtype),
    legendKey: "other",
    normalizedZone,
    normalizedZoneSubtype,
  };
}

export function classifyParcelFloodAttributes(
  attrs: Readonly<Record<string, unknown>>
): FloodZoneClassification {
  return classifyFloodZone({
    zone: attrs.fema_flood_zone,
    zoneSubtype: attrs.fema_flood_zone_subtype,
  });
}
