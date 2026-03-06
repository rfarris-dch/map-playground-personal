import type {
  DocsNavigationGroup,
  DocsPage,
  DocsPrevNextLink,
} from "@/features/docs/docs-content.types";

export interface DerivedPageMeta {
  readonly order: number;
  readonly sectionOrder: number;
  readonly sectionTitle: string;
  readonly slug: string;
}

interface DocsNavigationDefinition {
  readonly folder: string;
  readonly order: number;
  readonly pageOrderByStem: Readonly<Record<string, number>>;
  readonly title: string;
}

const sourceExtensionPattern = /\.(md|qmd)$/u;
const contentRootPattern = /^.*?\/content\//u;

export const docsNavigationDefinitions: readonly DocsNavigationDefinition[] = [
  {
    folder: "getting-started",
    order: 1,
    title: "Getting Started",
    pageOrderByStem: {
      "start-here": 1,
      "workspace-and-commands": 2,
    },
  },
  {
    folder: "repository",
    order: 2,
    title: "Repository",
    pageOrderByStem: {
      architecture: 1,
      "information-architecture": 2,
    },
  },
  {
    folder: "applications",
    order: 3,
    title: "Applications",
    pageOrderByStem: {
      "web-runtime": 1,
      "web-feature-domains": 2,
      "api-runtime": 3,
      "api-geo-slices": 4,
      "pipeline-monitor": 5,
    },
  },
  {
    folder: "packages",
    order: 4,
    title: "Packages",
    pageOrderByStem: {
      "core-runtime": 1,
      contracts: 2,
      "map-engine": 3,
      "map-layer-catalog": 4,
      "map-style": 5,
      "data-and-operations": 6,
    },
  },
  {
    folder: "data-and-sync",
    order: 5,
    title: "Data And Sync",
    pageOrderByStem: {
      "sync-architecture": 1,
    },
  },
  {
    folder: "operations",
    order: 6,
    title: "Operations",
    pageOrderByStem: {
      "parcel-and-tile-workflows": 1,
      "runbooks-and-troubleshooting": 2,
    },
  },
  {
    folder: "references",
    order: 7,
    title: "References",
    pageOrderByStem: {
      "contracts-and-api-surfaces": 1,
      "source-reference-patterns": 2,
    },
  },
  {
    folder: "contributing",
    order: 8,
    title: "Contributing",
    pageOrderByStem: {
      "docs-authoring": 1,
      "release-checklist": 2,
    },
  },
  {
    folder: "artifacts",
    order: 9,
    title: "Artifacts",
    pageOrderByStem: {
      "architecture-artifacts": 1,
    },
  },
];

function getSourceStem(sourceFile: string): string {
  const fileName = sourceFile.split("/").at(-1) ?? sourceFile;
  return fileName.replace(sourceExtensionPattern, "");
}

function sortPages(pages: readonly DocsPage[]): readonly DocsPage[] {
  return [...pages].sort((left, right) => {
    if (left.sectionOrder !== right.sectionOrder) {
      return left.sectionOrder - right.sectionOrder;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.title.localeCompare(right.title);
  });
}

export function derivePageMeta(sourceFile: string): DerivedPageMeta {
  const normalizedSourceFile = sourceFile.replace(contentRootPattern, "");
  const segments = normalizedSourceFile.split("/");
  const folder = segments[0];
  const stem = getSourceStem(sourceFile);

  if (!folder) {
    throw new Error(`Unable to derive docs section for ${sourceFile}`);
  }

  const navigationDefinition = docsNavigationDefinitions.find((entry) => entry.folder === folder);
  if (typeof navigationDefinition === "undefined") {
    throw new Error(`Unsupported docs content folder \`${folder}\` in ${sourceFile}`);
  }

  if (folder === "getting-started" && stem === "start-here") {
    return {
      slug: "/",
      sectionTitle: navigationDefinition.title,
      sectionOrder: navigationDefinition.order,
      order: navigationDefinition.pageOrderByStem[stem] ?? 999,
    };
  }

  return {
    slug: `/docs/${folder}/${stem}`,
    sectionTitle: navigationDefinition.title,
    sectionOrder: navigationDefinition.order,
    order: navigationDefinition.pageOrderByStem[stem] ?? 999,
  };
}

export function buildNavigationGroups(pages: readonly DocsPage[]): readonly DocsNavigationGroup[] {
  return docsNavigationDefinitions
    .map((entry) => ({
      title: entry.title,
      order: entry.order,
      pages: sortPages(pages.filter((page) => page.sectionTitle === entry.title)),
    }))
    .filter((group) => group.pages.length > 0);
}

export function sortDocsPages(pages: readonly DocsPage[]): readonly DocsPage[] {
  return sortPages(pages);
}

export function findPrevNextLink(slug: string, pages: readonly DocsPage[]): DocsPrevNextLink {
  const pageIndex = pages.findIndex((page) => page.slug === slug);

  if (pageIndex < 0) {
    return {
      previous: undefined,
      next: undefined,
    };
  }

  return {
    previous: pages.at(pageIndex - 1),
    next: pages.at(pageIndex + 1),
  };
}
