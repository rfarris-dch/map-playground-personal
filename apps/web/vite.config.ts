import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite";

const defaultApiProxyTarget = "http://127.0.0.1:3001";
const apiProxyTarget =
  process.env.MAP_WEB_API_PROXY_TARGET ??
  process.env.VITE_API_PROXY_TARGET ??
  defaultApiProxyTarget;
const mapWebPort = Number(process.env.MAP_WEB_PORT ?? "5143");
const useExternalTileManifests = process.env.VITE_TILE_MANIFEST_MODE === "external";

/**
 * Vite plugin that resolves `@map-migration/*` workspace package subpath exports
 * by reading each package's `exports` field and mapping import specifiers directly
 * to their dist files. This works around Vite 8's unreliable handling of subpath
 * exports through bun workspace symlinks.
 */
function workspaceSubpathExports(): Plugin {
  const packagesDir = fileURLToPath(new URL("../../packages", import.meta.url));
  const cache = new Map<string, string>();

  function readDistFile(target: unknown): string | null {
    if (typeof target === "string") {
      return target;
    }

    if (typeof target !== "object" || target === null) {
      return null;
    }

    const defaultTarget = Reflect.get(target, "default");
    return typeof defaultTarget === "string" ? defaultTarget : null;
  }

  function readPackageSubpathEntries(entry: fs.Dirent): readonly [string, string][] {
    if (!entry.isDirectory()) {
      return [];
    }

    const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(pkgJsonPath)) {
      return [];
    }

    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (!(pkg.exports && pkg.name)) {
      return [];
    }

    const results: [string, string][] = [];
    for (const [subpath, target] of Object.entries(pkg.exports)) {
      if (subpath === ".") {
        continue;
      }

      const distFile = readDistFile(target);
      if (distFile === null) {
        continue;
      }

      const importSpecifier = `${pkg.name}/${subpath.slice(2)}`;
      results.push([importSpecifier, path.join(packagesDir, entry.name, distFile)]);
    }

    return results;
  }

  function buildCache(): void {
    if (cache.size > 0) {
      return;
    }

    for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
      for (const [importSpecifier, resolvedPath] of readPackageSubpathEntries(entry)) {
        cache.set(importSpecifier, resolvedPath);
      }
    }
  }

  return {
    name: "workspace-subpath-exports",
    enforce: "pre",
    resolveId(source) {
      if (!source.startsWith("@map-migration/")) {
        return null;
      }
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
      "@map-migration/geo-tiles",
      "@map-migration/http-contracts",
      "@map-migration/map-engine",
      "@map-migration/map-layer-catalog",
      "@map-migration/map-style",
    ],
  },
  build: {
    target: "esnext",
  },
  publicDir: useExternalTileManifests ? "public-static" : "public",
  resolve: {
    dedupe: ["maplibre-gl"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number.isFinite(mapWebPort) ? mapWebPort : 5143,
    strictPort: true,
    fs: {
      allow: [
        fileURLToPath(new URL(".", import.meta.url)),
        fileURLToPath(new URL("../../packages", import.meta.url)),
      ],
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        configure: (proxy) => {
          // Defer to run after Vite registers its own error handler, then
          // replace all error listeners with a silent one so ECONNREFUSED
          // noise never hits the console during API restarts.
          process.nextTick(() => {
            proxy.removeAllListeners("error");
            proxy.on("error", (_err, _req, res) => {
              if (res instanceof http.ServerResponse && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "API unavailable — it may be restarting" }));
              }
            });
          });
        },
      },
    },
  },
});
