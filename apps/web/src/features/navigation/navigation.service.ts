import type { AppNavigationItem, FacilityNavigationItem } from "./navigation.types";

export const appNavigationItems: readonly AppNavigationItem[] = [
  {
    label: "Map",
    routeName: "map",
    to: "/map",
  },
  {
    label: "Markets",
    routeName: "markets",
    to: "/markets",
  },
  {
    label: "Providers",
    routeName: "providers",
    to: "/providers",
  },
  {
    label: "Facilities",
    routeName: "facilities",
    to: "/facilities",
  },
];

export const facilityNavigationItems: readonly FacilityNavigationItem[] = [
  {
    description: "Largest footprints, cloud-first tenancy, and utility-scale power planning.",
    label: "Hyperscale",
    routeName: "facilities-hyperscale",
    to: "/facilities/hyperscale",
  },
  {
    description: "Carrier-dense, retail-oriented colocation footprints and interconnection hubs.",
    label: "Colocation",
    routeName: "facilities-colocation",
    to: "/facilities/colocation",
  },
];
