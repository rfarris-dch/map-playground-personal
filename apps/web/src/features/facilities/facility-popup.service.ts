interface FacilityPopupAddressTextArgs {
  readonly address: string | null;
  readonly city: string | null;
  readonly facilityCode?: string | null;
  readonly facilityName: string;
  readonly providerName: string;
  readonly stateAbbrev: string | null;
}

interface FacilityPopupCodeTextArgs {
  readonly facilityCode: string | null;
  readonly providerName: string;
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.toLowerCase() === "null") {
    return null;
  }

  return normalized;
}

function matchesIgnoringCase(left: string | null, right: string | null): boolean {
  if (left === null || right === null) {
    return false;
  }

  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function resolveStreetLine(args: FacilityPopupAddressTextArgs): string | null {
  const address = normalizeText(args.address);
  if (address !== null) {
    return address;
  }

  const facilityName = normalizeText(args.facilityName);
  if (facilityName === null) {
    return null;
  }

  if (matchesIgnoringCase(facilityName, normalizeText(args.providerName))) {
    return null;
  }

  if (matchesIgnoringCase(facilityName, normalizeText(args.facilityCode))) {
    return null;
  }

  return facilityName;
}

export function buildFacilityPopupCodeText(args: FacilityPopupCodeTextArgs): string | null {
  const code = normalizeText(args.facilityCode);
  if (code === null) {
    return null;
  }

  if (matchesIgnoringCase(code, normalizeText(args.providerName))) {
    return null;
  }

  return code;
}

export function buildFacilityPopupAddressText(args: FacilityPopupAddressTextArgs): string | null {
  const parts = [
    resolveStreetLine(args),
    normalizeText(args.city),
    normalizeText(args.stateAbbrev),
  ].filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(", ") : null;
}
