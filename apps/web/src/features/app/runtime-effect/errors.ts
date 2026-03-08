import { Data } from "effect";

export class ManifestAbortError extends Data.TaggedError("ManifestAbortError") {}

export class ManifestHttpError extends Data.TaggedError("ManifestHttpError")<{
  readonly status: number;
  readonly statusText: string;
}> {}

export class ManifestJsonParseError extends Data.TaggedError("ManifestJsonParseError") {}

export class ManifestNetworkError extends Data.TaggedError("ManifestNetworkError")<{
  readonly cause: unknown;
}> {}

export function createAbortError(): Error | DOMException {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }

  const error = new Error("The operation was aborted.");
  Object.defineProperty(error, "name", {
    configurable: true,
    enumerable: false,
    value: "AbortError",
    writable: true,
  });
  return error;
}
