import type { BBox } from "./geometry.js";

export interface AoiBboxLimits {
  readonly maxHeightDegrees: number;
  readonly maxWidthDegrees: number;
}

export function aoiBboxExceedsLimits(bbox: BBox, limits: AoiBboxLimits): boolean {
  const east = bbox.east >= bbox.west ? bbox.east : bbox.east + 360;
  const width = east - bbox.west;
  const height = bbox.north - bbox.south;

  return width > limits.maxWidthDegrees || height > limits.maxHeightDegrees;
}
