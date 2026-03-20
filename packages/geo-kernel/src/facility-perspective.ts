import { z } from "zod";

export const FacilityPerspectiveSchema = z.enum([
  "colocation",
  "hyperscale",
  "hyperscale-leased",
  "enterprise",
]);
export type FacilityPerspective = z.infer<typeof FacilityPerspectiveSchema>;

export function parseFacilityPerspectiveParam(
  value: string | undefined
): FacilityPerspective | null {
  return parseFacilityPerspective(value);
}

export function parseFacilityPerspective(value: unknown): FacilityPerspective | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = FacilityPerspectiveSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
