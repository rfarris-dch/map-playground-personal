import { docsCollection, searchDocsPages } from "@/features/docs/docs-content.service";
import type {
  ReleaseVerificationGroupDefinition,
  ReleaseVerificationGroupResult,
  ReleaseVerificationItemDefinition,
} from "@/features/docs/release-verification.types";

const releaseVerificationDefinitions: readonly ReleaseVerificationGroupDefinition[] = [
  {
    title: "Getting Started",
    description:
      "Onboarding pages must stay visible in navigation and searchable by the terms new contributors use first.",
    items: [
      {
        label: "Start Here",
        slug: "/",
        searchQuery: "start here",
      },
      {
        label: "Workspace And Commands",
        slug: "/docs/getting-started/workspace-and-commands",
        searchQuery: "workspace and commands",
      },
    ],
  },
  {
    title: "Applications",
    description:
      "Application docs need route-level coverage for the web runtime, backend runtime, and the monitoring surface.",
    items: [
      {
        label: "Web Runtime Foundations",
        slug: "/docs/applications/web-runtime",
        searchQuery: "web runtime foundations",
      },
      {
        label: "Web Feature Domains",
        slug: "/docs/applications/web-feature-domains",
        searchQuery: "web feature domains",
      },
      {
        label: "API Runtime Foundations",
        slug: "/docs/applications/api-runtime",
        searchQuery: "api runtime foundations",
      },
      {
        label: "API Geo Slices",
        slug: "/docs/applications/api-geo-slices",
        searchQuery: "api geo slices",
      },
      {
        label: "Pipeline Monitor",
        slug: "/docs/applications/pipeline-monitor",
        searchQuery: "pipeline monitor",
      },
    ],
  },
  {
    title: "Packages",
    description:
      "Shared packages need both orientation pages and package-specific entries in the same search surface.",
    items: [
      {
        label: "Core Runtime Packages",
        slug: "/docs/packages/core-runtime",
        searchQuery: "core runtime packages",
      },
      {
        label: "Contracts",
        slug: "/docs/packages/contracts",
        searchQuery: "contracts",
      },
      {
        label: "Map Engine",
        slug: "/docs/packages/map-engine",
        searchQuery: "map engine",
      },
      {
        label: "Map Layer Catalog",
        slug: "/docs/packages/map-layer-catalog",
        searchQuery: "map layer catalog",
      },
      {
        label: "Map Style",
        slug: "/docs/packages/map-style",
        searchQuery: "map style",
      },
      {
        label: "Data And Operations Packages",
        slug: "/docs/packages/data-and-operations",
        searchQuery: "data and operations",
      },
    ],
  },
  {
    title: "Operations And References",
    description:
      "Operational guidance and source-reference patterns must be easy to find during incidents and code reviews.",
    items: [
      {
        label: "Parcel And Tile Workflows",
        slug: "/docs/operations/parcel-and-tile-workflows",
        searchQuery: "parcel and tile workflows",
      },
      {
        label: "Runbooks And Troubleshooting",
        slug: "/docs/operations/runbooks-and-troubleshooting",
        searchQuery: "runbooks and troubleshooting",
      },
      {
        label: "Contracts And API Surfaces",
        slug: "/docs/references/contracts-and-api-surfaces",
        searchQuery: "contracts and api surfaces",
      },
      {
        label: "Source Reference Patterns",
        slug: "/docs/references/source-reference-patterns",
        searchQuery: "source reference patterns",
      },
    ],
  },
  {
    title: "Artifacts",
    description:
      "Imported architecture, research, review, and runbook artifacts must remain in the same navigation and search graph as authored docs.",
    items: [
      {
        label: "Architecture Artifacts",
        slug: "/docs/artifacts/architecture-artifacts",
        searchQuery: "architecture artifacts",
      },
      {
        label: "Main Initial Research",
        slug: "/docs/artifacts/main-intitial-research",
        searchQuery: "main initial research",
      },
      {
        label: "Spatial Analysis OpenAPI Artifact",
        slug: "/docs/artifacts/spatial-analysis-openapi",
        searchQuery: "openapi artifact",
      },
      {
        label: "Spatial Analysis Ops Runbook",
        slug: "/docs/artifacts/spatial-analysis-ops",
        searchQuery: "ops runbook",
      },
    ],
  },
];

function hasSearchHit(query: string, slug: string): boolean {
  return searchDocsPages(query).some(
    (item) => item.slug === slug || item.slug.startsWith(`${slug}#`)
  );
}

function resolveItem(definition: ReleaseVerificationItemDefinition) {
  return {
    ...definition,
    navigationReady: docsCollection.pages.some((page) => page.slug === definition.slug),
    searchReady: hasSearchHit(definition.searchQuery, definition.slug),
  };
}

export const releaseVerificationGroups: readonly ReleaseVerificationGroupResult[] =
  releaseVerificationDefinitions.map((group) => ({
    title: group.title,
    description: group.description,
    items: group.items.map((item) => resolveItem(item)),
  }));

export const hasReleaseVerificationFailures = releaseVerificationGroups.some((group) =>
  group.items.some((item) => !(item.navigationReady && item.searchReady))
);
