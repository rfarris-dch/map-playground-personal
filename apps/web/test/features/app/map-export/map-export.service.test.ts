import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { FakeMap } from "../../../support/fake-map";

mock.restore();

const captureMapImageForExportMock = mock(async () => new Blob(["captured-map"]));
const composeMapCaptureWithCurrentOverlayMock = mock(async () => new Blob(["composed-map"]));
const loadBlobImageMock = mock(async () => ({
  naturalHeight: 768,
  naturalWidth: 1024,
}));

mock.module("@/features/app/map-export/map-capture.service", () => ({
  captureMapImageForExport: captureMapImageForExportMock,
}));

mock.module("@/features/app/map-export/map-export-render.service", () => ({
  composeMapCaptureWithCurrentOverlay: composeMapCaptureWithCurrentOverlayMock,
  loadBlobImage: loadBlobImageMock,
}));

const { exportMapView } = await import(
  "../../../../src/features/app/map-export/map-export.service.ts?map-export-service-test"
);

describe("map export service", () => {
  const createObjectUrl = mock(() => "blob:map-export");
  const revokeObjectUrl = mock();
  const clickMock = mock();
  const originalDocument = Reflect.get(globalThis, "document");
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    captureMapImageForExportMock.mockReset();
    captureMapImageForExportMock.mockImplementation(async () => new Blob(["captured-map"]));
    composeMapCaptureWithCurrentOverlayMock.mockReset();
    composeMapCaptureWithCurrentOverlayMock.mockImplementation(
      async () => new Blob(["composed-map"])
    );
    loadBlobImageMock.mockClear();
    createObjectUrl.mockReset();
    createObjectUrl.mockImplementation(() => "blob:map-export");
    revokeObjectUrl.mockReset();
    clickMock.mockReset();

    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    Reflect.set(globalThis, "document", {
      createElement(tagName: string) {
        if (tagName === "a") {
          return {
            click: clickMock,
            download: "",
            href: "",
          };
        }

        return {
          tagName: tagName.toUpperCase(),
        };
      },
    });
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    Reflect.set(globalThis, "document", originalDocument);
    mock.restore();
  });

  it("captures the map, composites the live overlays, and downloads the rendered image", async () => {
    const mapContainer = document.createElement("section");
    const map = new FakeMap();

    await exportMapView({
      format: "png",
      map,
      mapContainer,
    });

    expect(captureMapImageForExportMock).toHaveBeenCalledTimes(1);
    expect(composeMapCaptureWithCurrentOverlayMock).toHaveBeenCalledTimes(1);
    expect(composeMapCaptureWithCurrentOverlayMock.mock.calls[0]?.[0]).toMatchObject({
      mapContainer,
      type: "image/png",
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:map-export");
    expect(clickMock).toHaveBeenCalledTimes(1);
  });
});
