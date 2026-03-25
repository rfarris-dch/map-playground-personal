import type { CommissionedSemantic } from "@map-migration/geo-kernel/commissioned-semantic";
import { toLifecycleDisplayLabel } from "@/features/spatial-analysis/facility-lifecycle";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { SpatialAnalysisFacilityComparable } from "@/features/spatial-analysis/spatial-analysis-facilities.service.types";

function perspectiveSortRank(perspective: FacilityPerspective): number {
  if (perspective === "colocation") {
    return 0;
  }

  if (perspective === "hyperscale") {
    return 1;
  }

  return 2;
}

export function toSpatialAnalysisPerspectiveLabel(perspective: FacilityPerspective): string {
  return perspective === "colocation" ? "Colocation" : "Hyperscale";
}

export function toSpatialAnalysisSemanticLabel(value: string): string {
  return toLifecycleDisplayLabel({
    commissionedSemantic: value as CommissionedSemantic,
    leaseOrOwn: null,
    statusLabel: null,
  });
}

export function toSpatialAnalysisCoordinateText(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(5);
}

export function compareSpatialAnalysisFacilities<T extends SpatialAnalysisFacilityComparable>(
  left: T,
  right: T
): number {
  const leftPerspectiveRank = perspectiveSortRank(left.perspective);
  const rightPerspectiveRank = perspectiveSortRank(right.perspective);
  if (leftPerspectiveRank !== rightPerspectiveRank) {
    return leftPerspectiveRank - rightPerspectiveRank;
  }

  if (left.perspective !== right.perspective) {
    return left.perspective.localeCompare(right.perspective);
  }

  const leftPower = left.commissionedPowerMw ?? -1;
  const rightPower = right.commissionedPowerMw ?? -1;
  if (rightPower !== leftPower) {
    return rightPower - leftPower;
  }

  if (left.facilityName !== right.facilityName) {
    return left.facilityName.localeCompare(right.facilityName);
  }

  return left.facilityId.localeCompare(right.facilityId);
}
