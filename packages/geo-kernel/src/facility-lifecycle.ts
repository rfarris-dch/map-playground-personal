import type { CommissionedSemantic, LeaseOrOwn } from "./commissioned-semantic.js";

export interface FacilityLifecycle {
  readonly commissionedSemantic: CommissionedSemantic;
  readonly leaseOrOwn: LeaseOrOwn | null;
  readonly statusLabel: string | null;
}

export type FacilityLifecycleBucket =
  | "operational"
  | "leased"
  | "under_construction"
  | "planned"
  | "unknown";

export function toLifecycleBucket(lifecycle: FacilityLifecycle): FacilityLifecycleBucket {
  return lifecycle.commissionedSemantic;
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
  }
}

export function isCommissionedCapacity(lifecycle: FacilityLifecycle): boolean {
  return (
    lifecycle.commissionedSemantic === "operational" ||
    lifecycle.commissionedSemantic === "leased"
  );
}
