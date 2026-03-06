import type {
  WorkspaceHeroModel,
  WorkspaceHeroTab,
  WorkspaceSurface,
} from "@/features/docs/workspace-surface.types";

interface WorkspacePackageManifest {
  readonly name?: unknown;
}

const packageManifestPathPattern = /\/([^/]+)\/package\.json$/;

const appManifestModules = import.meta.glob("../../../../*/package.json", {
  eager: true,
  import: "default",
});

const packageManifestModules = import.meta.glob("../../../../../packages/*/package.json", {
  eager: true,
  import: "default",
});

const appTabOrder = ["docs", "web", "api", "pipeline-monitor"];
const appSurfaces = sortWorkspaceSurfaces(loadWorkspaceSurfaces("apps", appManifestModules));
const packageSurfaces = sortWorkspaceSurfaces(
  loadWorkspaceSurfaces("packages", packageManifestModules)
);

export const workspaceHeroModel: WorkspaceHeroModel = {
  appCount: appSurfaces.length,
  codeSample: buildWorkspaceCodeSample(appSurfaces, packageSurfaces),
  packageCount: packageSurfaces.length,
  tabs: createWorkspaceHeroTabs(appSurfaces),
};

function loadWorkspaceSurfaces(
  workspaceRoot: "apps" | "packages",
  modules: Record<string, unknown>
): readonly WorkspaceSurface[] {
  return Object.entries(modules)
    .map(([sourceFile, manifest]) => createWorkspaceSurface(workspaceRoot, sourceFile, manifest))
    .filter((surface): surface is WorkspaceSurface => surface !== null);
}

function createWorkspaceSurface(
  workspaceRoot: "apps" | "packages",
  sourceFile: string,
  manifest: unknown
): WorkspaceSurface | null {
  const directoryName = extractDirectoryName(sourceFile);
  if (typeof directoryName !== "string") {
    return null;
  }

  const packageName = readPackageName(manifest);

  return {
    directoryName,
    displayPath: `${workspaceRoot}/${directoryName}`,
    packageName: packageName ?? directoryName,
  };
}

function extractDirectoryName(sourceFile: string): string | undefined {
  const match = sourceFile.match(packageManifestPathPattern);
  return match?.[1];
}

function readPackageName(manifest: unknown): string | undefined {
  if (!isWorkspacePackageManifest(manifest)) {
    return undefined;
  }

  return typeof manifest.name === "string" && manifest.name.length > 0 ? manifest.name : undefined;
}

function isWorkspacePackageManifest(manifest: unknown): manifest is WorkspacePackageManifest {
  return typeof manifest === "object" && manifest !== null;
}

function sortWorkspaceSurfaces(surfaces: readonly WorkspaceSurface[]): readonly WorkspaceSurface[] {
  return [...surfaces].sort((left, right) => {
    const orderDelta = compareAppTabOrder(left.directoryName, right.directoryName);

    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.displayPath.localeCompare(right.displayPath);
  });
}

function compareAppTabOrder(leftDirectoryName: string, rightDirectoryName: string): number {
  const leftIndex = appTabOrder.indexOf(leftDirectoryName);
  const rightIndex = appTabOrder.indexOf(rightDirectoryName);

  if (leftIndex === -1 && rightIndex === -1) {
    return 0;
  }

  if (leftIndex === -1) {
    return 1;
  }

  if (rightIndex === -1) {
    return -1;
  }

  return leftIndex - rightIndex;
}

function createWorkspaceHeroTabs(apps: readonly WorkspaceSurface[]): readonly WorkspaceHeroTab[] {
  return apps.map((app) => ({
    name: app.displayPath,
    isActive: app.directoryName === "docs",
  }));
}

function buildWorkspaceCodeSample(
  apps: readonly WorkspaceSurface[],
  packages: readonly WorkspaceSurface[]
): string {
  const lines = [
    "export const workspace = {",
    formatWorkspaceArrayLine("apps", apps),
    "  packages: [",
    ...formatWorkspaceEntries(packages, 4),
    "  ],",
    "};",
  ];

  return lines.join("\n");
}

function formatWorkspaceArrayLine(
  label: "apps" | "packages",
  surfaces: readonly WorkspaceSurface[]
): string {
  const entries = surfaces.map((surface) => `"${surface.displayPath}"`).join(", ");
  return `  ${label}: [${entries}],`;
}

function formatWorkspaceEntries(
  surfaces: readonly WorkspaceSurface[],
  itemsPerLine: number
): readonly string[] {
  const lines: string[] = [];

  for (let index = 0; index < surfaces.length; index += itemsPerLine) {
    const chunk = surfaces
      .slice(index, index + itemsPerLine)
      .map((surface) => `"${surface.displayPath}"`)
      .join(", ");
    lines.push(`    ${chunk},`);
  }

  return lines;
}
