import type {
  CommissionedSemantic,
  LeaseOrOwn,
} from "@map-migration/geo-kernel/commissioned-semantic";

interface FacilityLifecycle {
  readonly commissionedSemantic: CommissionedSemantic;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly statusLabel: string | null;
}

export function toLifecycleDisplayLabel(lifecycle: FacilityLifecycle): string {
  if (lifecycle.statusLabel !== null && lifecycle.statusLabel.length > 0) {
    return lifecycle.statusLabel;
  }

  switch (lifecycle.commissionedSemantic) {
    case "operational":
      return "Operational";
    case "leased":
      return "Leased";
    case "under_construction":
      return "Under Construction";
    case "planned":
      return "Planned";
    case "unknown":
      return "Unknown";
    default:
      return lifecycle.commissionedSemantic;
  }
}
