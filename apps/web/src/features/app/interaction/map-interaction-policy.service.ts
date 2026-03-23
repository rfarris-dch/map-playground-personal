import type { MapInteractionSnapshot } from "@/features/app/interaction/map-interaction.types";

export function shouldRefreshViewportData(snapshot: MapInteractionSnapshot): boolean {
  if (snapshot.eventType === "load") {
    return true;
  }

  return snapshot.eventType === "moveend" && snapshot.interactionType !== "rotate-only";
}

export function shouldRefreshRenderedOverlays(snapshot: MapInteractionSnapshot): boolean {
  return snapshot.eventType === "moveend";
}
