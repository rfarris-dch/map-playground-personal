import type { FacilityPerspective } from "@map-migration/contracts";

export interface PerspectiveResolution {
  readonly error?: string;
  readonly ok: boolean;
  readonly perspective?: FacilityPerspective;
}
