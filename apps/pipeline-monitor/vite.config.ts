import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

const pipelineMonitorPort = Number(process.env.MAP_PIPELINE_MONITOR_PORT ?? "5144");

/**
 * Vite plugin that resolves `@map-migration/*` workspace package subpath exports
 * by reading each package's `exports` field and mapping import specifiers directly
 * to their dist files. This works around Vite 8's unreliable handling of subpath
 * exports through bun workspace symlinks.
 */
function workspaceSubpathExports(): Plugin {
  const packagesDir = fileURLToPath(new URL("../../packages", import.meta.url));
  const cache = new Map<string, string>();

  function buildCache(): void {
    if (cache.size > 0) return;
    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
      if (!fs.existsSync(pkgJsonPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (!pkg.exports || !pkg.name) continue;
      for (const [subpath, target] of Object.entries(pkg.exports)) {
        if (subpath === ".") continue;
        const distFile = typeof target === "string" ? target : (target as Record<string, string>).default;
        if (!distFile) continue;
        const importSpecifier = `${pkg.name}/${subpath.slice(2)}`;
        cache.set(importSpecifier, path.join(packagesDir, entry.name, distFile));
      }
    }
  }

  return {
    name: "workspace-subpath-exports",
    enforce: "pre",
    resolveId(source) {
      if (!source.startsWith("@map-migration/")) return null;
      buildCache();
      return cache.get(source) ?? null;
    },
  };
}

export default defineConfig({
  plugins: [workspaceSubpathExports(), vue(), tailwindcss()],
  optimizeDeps: {
    exclude: [
      "@map-migration/core-runtime",
      "@map-migration/geo-kernel",
      "@map-migration/http-contracts",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: Number.isFinite(pipelineMonitorPort) ? pipelineMonitorPort : 5144,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../../packages", import.meta.url))],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
