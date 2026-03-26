import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { FakeMap } from "../../../support/fake-map";

mock.restore();

const disposePmtilesProtocolMock = mock();
const exportMapCaptureImageMock = mock(async () => new Blob(["captured-map"]));

let exportMap: FakeMap | null = null;

mock.module("@map-migration/map-engine", () => ({
  createMap: () => {
    exportMap = new FakeMap();
    exportMap.captureImage = exportMapCaptureImageMock;
    exportMap.triggerRepaint = () => {
      queueMicrotask(() => {
        exportMap?.emit("idle");
      });
    };

    queueMicrotask(() => {
      exportMap?.emit("load");
    });

    return exportMap;
  },
  createMapLibreAdapter: () => ({}),
  registerPmtilesProtocol: () => disposePmtilesProtocolMock,
}));

const { captureMapImageForExport } = await import(
  "../../../../src/features/app/map-export/map-capture.service.ts?map-capture-export-test"
);

describe("map capture export service", () => {
  const originalDocument = Reflect.get(globalThis, "document");
  const originalRequestAnimationFrame = Reflect.get(globalThis, "requestAnimationFrame");
  const originalWindow = Reflect.get(globalThis, "window");

  beforeEach(() => {
    disposePmtilesProtocolMock.mockReset();
    exportMapCaptureImageMock.mockReset();
    exportMapCaptureImageMock.mockImplementation(async () => new Blob(["captured-map"]));
    exportMap = null;

    Reflect.set(globalThis, "document", {
      body: {
        append() {
          /* noop */
        },
      },
      createElement() {
        return {
          remove() {
            /* noop */
          },
          setAttribute() {
            /* noop */
          },
          style: {},
        };
      },
    });
    Reflect.set(globalThis, "requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    Reflect.set(globalThis, "window", {
      clearTimeout,
      setTimeout,
    });
  });

  afterAll(() => {
    Reflect.set(globalThis, "document", originalDocument);
    Reflect.set(globalThis, "requestAnimationFrame", originalRequestAnimationFrame);
    Reflect.set(globalThis, "window", originalWindow);
    mock.restore();
  });

  it("mirrors runtime images into the export map before capture", async () => {
    const sourceMap = new FakeMap();
    sourceMap.addImage("logo-provider-1", {
      width: 1,
      height: 1,
      data: new Uint8Array([255, 0, 0, 255]),
    });

    const blob = await captureMapImageForExport({ map: sourceMap });

    expect(await blob.text()).toBe("captured-map");
    expect(exportMapCaptureImageMock).toHaveBeenCalledTimes(1);
    expect(exportMap?.hasImage("logo-provider-1")).toBe(true);
    expect(exportMap?.destroyed).toBe(true);
    expect(disposePmtilesProtocolMock).toHaveBeenCalledTimes(1);
  });
});
