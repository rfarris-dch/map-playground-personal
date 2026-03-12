import { afterEach, describe, expect, it } from "bun:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { brotliCompressSync } from "node:zlib";
import { validateTileDelivery } from "./validate-tile-delivery";

interface TileServerOptions {
  readonly omitAcceptRanges?: boolean;
  readonly pmtilesContentEncoding?: string;
}

interface TileTestServer {
  readonly close: () => Promise<void>;
  readonly manifestUrl: string;
}

function handleTileRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: TileServerOptions
): void {
  if (request.url === "/tiles/parcels-draw-v1/latest.json") {
    response.writeHead(200, {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "application/json",
    });
    response.end(
      JSON.stringify({
        current: {
          checksum: "deadbeef",
          dataset: "parcels-draw-v1",
          url: "20260310.deadbeef.pmtiles",
          version: "20260310.deadbeef",
        },
        dataset: "parcels-draw-v1",
        previous: null,
        publishedAt: "2026-03-10T00:00:00.000Z",
      })
    );
    return;
  }

  if (request.url === "/tiles/parcels-draw-v1/20260310.deadbeef.pmtiles") {
    const pmtilesBody =
      options.pmtilesContentEncoding === "br"
        ? brotliCompressSync(Buffer.from("p"))
        : Buffer.from("p");
    response.writeHead(206, {
      "Cache-Control": "public, max-age=31536000, immutable",
      ...(options.omitAcceptRanges ? {} : { "Accept-Ranges": "bytes" }),
      ...(typeof options.pmtilesContentEncoding === "string"
        ? { "Content-Encoding": options.pmtilesContentEncoding }
        : {}),
      "Content-Range": "bytes 0-0/4",
      "Content-Type": "application/octet-stream",
    });
    response.end(pmtilesBody);
    return;
  }

  response.writeHead(404);
  response.end("not found");
}

async function startTileServer(options: TileServerOptions = {}): Promise<TileTestServer> {
  const server = createServer((request, response) => {
    handleTileRequest(request, response, options);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("failed to resolve test server address");
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error instanceof Error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
    manifestUrl: `http://127.0.0.1:${String(address.port)}/tiles/parcels-draw-v1/latest.json`,
  };
}

describe("validate-tile-delivery", () => {
  let activeServer: TileTestServer | null = null;

  afterEach(async () => {
    if (activeServer !== null) {
      await activeServer.close();
      activeServer = null;
    }
  });

  it("accepts manifest-relative PMTiles behind the same external origin", async () => {
    activeServer = await startTileServer();

    await expect(
      validateTileDelivery({
        allowHttp: true,
        dataset: "parcels-draw-v1",
        expectedManifestCacheControl: "public,max-age=60",
        expectedPmtilesCacheControl: "public,max-age=31536000,immutable",
        manifestUrl: activeServer.manifestUrl,
        requestTimeoutMs: 5000,
      })
    ).resolves.toEqual({
      dataset: "parcels-draw-v1",
      manifestUrl: activeServer.manifestUrl,
      pmtilesUrl: activeServer.manifestUrl.replace("latest.json", "20260310.deadbeef.pmtiles"),
    });
  });

  it("rejects PMTiles responses that are compressed in transit", async () => {
    activeServer = await startTileServer({
      pmtilesContentEncoding: "br",
    });

    await expect(
      validateTileDelivery({
        allowHttp: true,
        dataset: "parcels-draw-v1",
        expectedManifestCacheControl: "public,max-age=60",
        expectedPmtilesCacheControl: "public,max-age=31536000,immutable",
        manifestUrl: activeServer.manifestUrl,
        requestTimeoutMs: 5000,
      })
    ).rejects.toThrow('PMTiles response must not use content-encoding (received "br")');
  });

  it("accepts range responses that omit Accept-Ranges when Content-Range is correct", async () => {
    activeServer = await startTileServer({
      omitAcceptRanges: true,
    });

    await expect(
      validateTileDelivery({
        allowHttp: true,
        dataset: "parcels-draw-v1",
        expectedManifestCacheControl: "public,max-age=60",
        expectedPmtilesCacheControl: "public,max-age=31536000,immutable",
        manifestUrl: activeServer.manifestUrl,
        requestTimeoutMs: 5000,
      })
    ).resolves.toEqual({
      dataset: "parcels-draw-v1",
      manifestUrl: activeServer.manifestUrl,
      pmtilesUrl: activeServer.manifestUrl.replace("latest.json", "20260310.deadbeef.pmtiles"),
    });
  });
});
