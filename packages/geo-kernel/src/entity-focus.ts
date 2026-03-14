import type { FacilityPerspective } from "./facility-perspective.js";

export interface EntityFocus {
  readonly activePerspectives?: FacilityPerspective[];
  readonly companyIds?: string[];
  readonly facilityIds?: string[];
  readonly marketIds?: string[];
  readonly providerIds?: string[];
}
