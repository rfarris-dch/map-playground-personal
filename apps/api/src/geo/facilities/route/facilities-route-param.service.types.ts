import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";

export interface PerspectiveResolution {
  readonly error?: string;
  readonly ok: boolean;
  readonly perspective?: FacilityPerspective;
}
