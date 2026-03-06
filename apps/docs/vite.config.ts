import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const docsPort = Number(process.env.MAP_DOCS_PORT ?? "5145");
const mermaidDependencyPackages = new Set([
  "@mermaid-js/parser",
  "cytoscape",
  "cytoscape-cose-bilkent",
  "cytoscape-fcose",
  "d3",
  "d3-sankey",
  "dagre-d3-es",
  "dayjs",
  "dompurify",
  "katex",
  "khroma",
  "lodash-es",
  "marked",
  "mermaid",
  "roughjs",
  "stylis",
  "uuid",
]);

function extractNodeModulePackageName(id: string): string | undefined {
  const packagePath = id.split("node_modules/")[1];

  if (typeof packagePath !== "string") {
    return undefined;
  }

  const segments = packagePath.split("/");
  const firstSegment = segments[0];
  const secondSegment = segments[1];

  if (typeof firstSegment !== "string" || firstSegment.length === 0) {
    return undefined;
  }

  if (firstSegment.startsWith("@")) {
    if (typeof secondSegment !== "string" || secondSegment.length === 0) {
      return undefined;
    }

    return `${firstSegment}/${secondSegment}`;
  }

  return firstSegment;
}

function createMermaidChunkName(packageName: string): string {
  return `docs-mermaid-${packageName.replaceAll("/", "-")}`;
}

function resolveManualChunk(id: string): string | undefined {
  const packageName = extractNodeModulePackageName(id);

  if (
    id.includes("/src/features/docs/docs-content.service.ts") ||
    id.includes("/src/features/docs/markdown.service.ts")
  ) {
    return "docs-content";
  }

  if (id.includes("/src/content/")) {
    return "docs-authored-content";
  }

  if (
    id.includes("/docs/architecture/") ||
    id.includes("/docs/research/") ||
    id.includes("/docs/review/") ||
    id.includes("/docs/runbooks/") ||
    id.includes("/docs/tasks/")
  ) {
    return "docs-artifacts";
  }

  if (packageName === "@headlessui/vue") {
    return "docs-search";
  }

  if (
    packageName === "markdown-it" ||
    packageName === "markdown-it-anchor" ||
    packageName === "prismjs"
  ) {
    return "docs-markdown";
  }

  if (typeof packageName === "string" && mermaidDependencyPackages.has(packageName)) {
    return createMermaidChunkName(packageName);
  }

  if (packageName === "vue" || packageName === "vue-router" || packageName?.startsWith("@vue/")) {
    return "framework";
  }

  return undefined;
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number.isFinite(docsPort) ? docsPort : 5145,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: Number.isFinite(docsPort) ? docsPort : 5145,
    strictPort: true,
  },
});
