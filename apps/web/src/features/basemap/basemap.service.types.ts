import type { BasemapProfile, BasemapVisibilityState } from "@/features/basemap/basemap.types";

export interface MountBasemapLayerVisibilityOptions {
  readonly profile?: BasemapProfile;
  readonly visibility?: BasemapVisibilityState;
}

export interface BasemapLayerGroups {
  readonly boundaryLayerIds: readonly string[];
  readonly labelLayerIds: readonly string[];
  readonly roadLayerIds: readonly string[];
}
