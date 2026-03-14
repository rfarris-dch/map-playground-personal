import type { ApiAppOptions } from "@/app.types";

export type RouteTimeoutProfile = "default" | "parcels" | "selection";
const routeTimeoutProfiles = new Map<string, Exclude<RouteTimeoutProfile, "default">>();

export function resolveRouteTimeoutMs(
  profile: RouteTimeoutProfile,
  options: ApiAppOptions
): number {
  if (profile === "parcels") {
    return options.parcelsRequestTimeoutMs;
  }

  if (profile === "selection") {
    return options.selectionRequestTimeoutMs;
  }

  return options.requestTimeoutMs;
}

export function registerRouteTimeoutProfile(
  path: string,
  profile: Exclude<RouteTimeoutProfile, "default">
): void {
  routeTimeoutProfiles.set(path, profile);
}

export function readRouteTimeoutProfile(path: string): RouteTimeoutProfile {
  const profile = routeTimeoutProfiles.get(path);
  return profile === "parcels" || profile === "selection" ? profile : "default";
}
