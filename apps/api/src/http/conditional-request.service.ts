const weakEtagPrefixPattern = /^W\//;

function normalizeEtagValue(value: string): string {
  return value.trim().replace(weakEtagPrefixPattern, "");
}

export function matchesIfNoneMatch(args: {
  readonly etag: string;
  readonly ifNoneMatchHeader: string | undefined;
}): boolean {
  if (typeof args.ifNoneMatchHeader !== "string") {
    return false;
  }

  const requestEtags = args.ifNoneMatchHeader
    .split(",")
    .map((value) => normalizeEtagValue(value))
    .filter((value) => value.length > 0);
  const responseEtag = normalizeEtagValue(args.etag);

  return requestEtags.includes("*") || requestEtags.includes(responseEtag);
}
