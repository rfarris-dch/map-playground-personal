import type { FacilityPerspective } from "@map-migration/geo-kernel";

export interface PerspectiveResolution {
  readonly error?: string;
  readonly ok: boolean;
  readonly perspective?: FacilityPerspective;
}
