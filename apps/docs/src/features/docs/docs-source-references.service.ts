import type { DocsPage } from "@/features/docs/docs-content.types";
import type {
  DocsPageSourceRole,
  DocsSourceKind,
  DocsSourceReferenceItem,
  DocsSourceReferenceSummary,
  RelatedDocsLink,
} from "@/features/docs/docs-source-references.types";

const docsAppContentImportPattern = /^(?:\.\.\/)+content\//u;
const legacyDocsImportPattern = /(docs\/(?:architecture|research|review|runbooks)\/.*)$/u;

function normalizeSourcePath(path: string): string {
  if (docsAppContentImportPattern.test(path)) {
    return path.replace(docsAppContentImportPattern, "apps/docs/src/content/");
  }

  const legacyDocsMatch = path.match(legacyDocsImportPattern);
  if (typeof legacyDocsMatch?.[1] === "string") {
    return legacyDocsMatch[1];
  }

  return path;
}

function createSourceKind(path: string): DocsSourceKind {
  if (path.startsWith("apps/docs/src/content/")) {
    return "docs";
  }

  if (path.startsWith("apps/")) {
    return "application";
  }

  if (path.startsWith("packages/")) {
    return "package";
  }

  if (path.startsWith("scripts/")) {
    return "script";
  }

  if (path.startsWith("docs/")) {
    return "artifact";
  }

  return "workspace";
}

function findRelatedDocs(path: string): RelatedDocsLink | undefined {
  if (path.startsWith("packages/contracts/")) {
    return {
      slug: "/docs/packages/contracts",
      title: "Contracts",
    };
  }

  if (path.startsWith("packages/map-engine/")) {
    return {
      slug: "/docs/packages/map-engine",
      title: "Map Engine",
    };
  }

  if (path.startsWith("packages/map-layer-catalog/")) {
    return {
      slug: "/docs/packages/map-layer-catalog",
      title: "Map Layer Catalog",
    };
  }

  if (path.startsWith("packages/map-style/")) {
    return {
      slug: "/docs/packages/map-style",
      title: "Map Style",
    };
  }

  if (
    path.startsWith("packages/geo-sql/") ||
    path.startsWith("packages/geo-tiles/") ||
    path.startsWith("packages/ops/") ||
    path.startsWith("packages/bench/") ||
    path.startsWith("packages/fixtures/")
  ) {
    return {
      slug: "/docs/packages/data-and-operations",
      title: "Data And Operations Packages",
    };
  }

  if (path === "apps/api/src/app.ts" || path.startsWith("apps/api/src/http/")) {
    return {
      slug: "/docs/applications/api-runtime",
      title: "API Runtime Foundations",
    };
  }

  if (path.startsWith("apps/api/src/geo/")) {
    return {
      slug: "/docs/applications/api-geo-slices",
      title: "API Geo Slices",
    };
  }

  if (path === "apps/api/src/sync-worker.ts") {
    return {
      slug: "/docs/data-and-sync/sync-architecture",
      title: "Sync Architecture",
    };
  }

  if (
    path.startsWith("apps/web/src/features/app/") ||
    path.startsWith("apps/web/src/pages/") ||
    path === "apps/web/src/lib/api-client.ts"
  ) {
    return {
      slug: "/docs/applications/web-runtime",
      title: "Web Runtime Foundations",
    };
  }

  if (path.startsWith("apps/web/src/features/")) {
    return {
      slug: "/docs/applications/web-feature-domains",
      title: "Web Feature Domains",
    };
  }

  if (path.startsWith("apps/pipeline-monitor/")) {
    return {
      slug: "/docs/applications/pipeline-monitor",
      title: "Pipeline Monitor",
    };
  }

  if (path.startsWith("scripts/")) {
    return {
      slug: "/docs/operations/parcel-and-tile-workflows",
      title: "Parcel And Tile Workflows",
    };
  }

  if (path === "docs/architecture/spatial-analysis-openapi.yaml") {
    return {
      slug: "/docs/artifacts/spatial-analysis-openapi",
      title: "Spatial Analysis OpenAPI Artifact",
    };
  }

  if (
    path.startsWith("docs/architecture/") ||
    path.startsWith("docs/research/") ||
    path.startsWith("docs/review/") ||
    path.startsWith("docs/runbooks/")
  ) {
    return {
      slug: "/docs/artifacts/architecture-artifacts",
      title: "Architecture Artifacts",
    };
  }

  return undefined;
}

function createDescription(role: DocsPageSourceRole, kind: DocsSourceKind): string {
  if (role === "authored-doc") {
    return "Explanatory docs content maintained inside the Vue docs app.";
  }

  if (role === "imported-artifact") {
    return "Imported legacy source artifact rendered directly inside the docs app.";
  }

  switch (kind) {
    case "application":
      return "Authoritative application runtime source.";
    case "package":
      return "Authoritative shared package source.";
    case "script":
      return "Authoritative operational script.";
    case "artifact":
      return "Authoritative architecture or runbook artifact.";
    case "docs":
      return "Authoritative docs source.";
    case "workspace":
      return "Authoritative workspace source.";
    default:
      return "Authoritative workspace source.";
  }
}

function createReferenceItem(path: string, role: DocsPageSourceRole): DocsSourceReferenceItem {
  const normalizedPath = normalizeSourcePath(path);
  const kind = createSourceKind(normalizedPath);

  return {
    path: normalizedPath,
    kind,
    role,
    description: createDescription(role, kind),
    relatedDocs: findRelatedDocs(normalizedPath),
  };
}

export function createDocsSourceReferenceSummary(page: DocsPage): DocsSourceReferenceSummary {
  const pageSourcePath = normalizeSourcePath(page.sourceFile);
  const pageSourceRole: DocsPageSourceRole = pageSourcePath.startsWith("apps/docs/src/content/")
    ? "authored-doc"
    : "imported-artifact";
  const seenPaths = new Set<string>([pageSourcePath]);
  const authoritativeSources: DocsSourceReferenceItem[] = [];

  for (const sourcePath of page.sources) {
    const normalizedPath = normalizeSourcePath(sourcePath);
    if (seenPaths.has(normalizedPath)) {
      continue;
    }

    seenPaths.add(normalizedPath);
    authoritativeSources.push(createReferenceItem(normalizedPath, "authoritative-source"));
  }

  return {
    pageSource: createReferenceItem(pageSourcePath, pageSourceRole),
    authoritativeSources,
  };
}
