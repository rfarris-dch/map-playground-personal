import type { FacilityPerspective } from "./facility-perspective.js";

export interface EntityFocus {
  readonly marketIds?: string[];
  readonly companyIds?: string[];
  readonly providerIds?: string[];
  readonly facilityIds?: string[];
  readonly activePerspectives?: FacilityPerspective[];
}
