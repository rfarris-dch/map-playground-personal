import type {
  QuickViewCard,
  QuickViewLayoutInput,
  QuickViewLayoutResult,
} from "@/features/quick-view/quick-view.types";
import type { ScannerFacility } from "@/features/scanner/scanner.types";
import type { Rect } from "./quick-view.service.types";

const CARD_WIDTH = 190;
const CARD_HEIGHT = 78;
const CARD_MARGIN = 10;

function overlaps(a: Rect, b: Rect): boolean {
  return !(
    a.x + CARD_WIDTH + CARD_MARGIN < b.x ||
    b.x + CARD_WIDTH + CARD_MARGIN < a.x ||
    a.y + CARD_HEIGHT + CARD_MARGIN < b.y ||
    b.y + CARD_HEIGHT + CARD_MARGIN < a.y
  );
}

function toScore(facility: ScannerFacility): number {
  const power = typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;
  return power;
}

function sortedFacilities(facilities: readonly ScannerFacility[]): ScannerFacility[] {
  const copy = [...facilities];
  copy.sort((left, right) => {
    const scoreDiff = toScore(right) - toScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return left.facilityName.localeCompare(right.facilityName);
  });

  return copy;
}

export function buildQuickViewLayout(input: QuickViewLayoutInput): QuickViewLayoutResult {
  const size = input.map.getCanvasSize();
  const ordered = sortedFacilities(input.facilities);
  const placedRects: Rect[] = [];
  const cards: QuickViewCard[] = [];

  for (const facility of ordered) {
    if (cards.length >= input.densityLimit) {
      break;
    }

    const projected = input.map.project(facility.coordinates);
    const anchorX = projected[0];
    const anchorY = projected[1];
    if (anchorX < 0 || anchorX > size.width || anchorY < 0 || anchorY > size.height) {
      continue;
    }

    const candidatePositions: Rect[] = [
      { x: anchorX - CARD_WIDTH / 2, y: anchorY - CARD_HEIGHT - 18 },
      { x: anchorX - CARD_WIDTH / 2, y: anchorY + 18 },
      { x: anchorX + 18, y: anchorY - CARD_HEIGHT / 2 },
      { x: anchorX - CARD_WIDTH - 18, y: anchorY - CARD_HEIGHT / 2 },
    ];

    const fit = candidatePositions.find((candidate) => {
      if (
        candidate.x < 8 ||
        candidate.y < 8 ||
        candidate.x + CARD_WIDTH > size.width - 8 ||
        candidate.y + CARD_HEIGHT > size.height - 8
      ) {
        return false;
      }

      return !placedRects.some((placed) => overlaps(candidate, placed));
    });

    if (!fit) {
      continue;
    }

    placedRects.push(fit);
    cards.push({
      id: `${facility.perspective}:${facility.facilityId}`,
      address: facility.address,
      availablePowerMw: facility.availablePowerMw,
      city: facility.city,
      commissionedPowerMw: facility.commissionedPowerMw,
      facilityCode: facility.facilityCode,
      facilityName: facility.facilityName,
      perspective: facility.perspective,
      plannedPowerMw: facility.plannedPowerMw,
      providerName: facility.providerName,
      screenX: fit.x,
      screenY: fit.y,
      stateAbbrev: facility.stateAbbrev,
      underConstructionPowerMw: facility.underConstructionPowerMw,
    });
  }

  return {
    cards,
    totalCount: ordered.length,
    hiddenCount: Math.max(ordered.length - cards.length, 0),
  };
}
