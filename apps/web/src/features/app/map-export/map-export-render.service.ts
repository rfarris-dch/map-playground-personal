import html2canvas from "@html2canvas/html2canvas";

function isMapCanvas(element: HTMLElement): boolean {
  return (
    element.classList.contains("maplibregl-canvas") || element.classList.contains("mapboxgl-canvas")
  );
}

function isMapControlContainer(element: HTMLElement): boolean {
  return (
    element.classList.contains("maplibregl-control-container") ||
    element.classList.contains("mapboxgl-control-container") ||
    element.classList.contains("maplibregl-ctrl") ||
    element.classList.contains("mapboxgl-ctrl")
  );
}

function canvasToBlob(args: {
  readonly canvas: HTMLCanvasElement;
  readonly quality?: number;
  readonly type: "image/jpeg" | "image/png";
}): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    args.canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("[map-export] Failed to encode the composed export image."));
          return;
        }

        resolve(blob);
      },
      args.type,
      args.type === "image/jpeg" ? args.quality : undefined
    );
  });
}

export function shouldIgnoreMapExportElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.closest("[data-map-export-ignore='true']") !== null) {
    return true;
  }

  if (isMapControlContainer(element)) {
    return true;
  }

  return element.tagName === "CANVAS" && isMapCanvas(element);
}

export async function captureMapOverlayCanvas(
  mapContainer: HTMLElement
): Promise<HTMLCanvasElement> {
  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;

  if (width <= 0 || height <= 0) {
    throw new Error("[map-export] Map container is not measurable for overlay capture.");
  }

  return await html2canvas(mapContainer, {
    backgroundColor: null,
    height,
    ignoreElements: shouldIgnoreMapExportElement,
    logging: false,
    scale: window.devicePixelRatio || 1,
    useCORS: true,
    width,
  });
}

export async function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(blob);

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("[map-export] Failed to load captured map image."));
    };
    image.src = imageUrl;
  });
}

export async function composeMapCaptureWithCurrentOverlay(args: {
  readonly capturedBlob: Blob;
  readonly mapContainer: HTMLElement;
  readonly quality?: number;
  readonly type: "image/jpeg" | "image/png";
}): Promise<Blob> {
  const [baseMapImage, overlayCanvas] = await Promise.all([
    loadBlobImage(args.capturedBlob),
    captureMapOverlayCanvas(args.mapContainer),
  ]);
  const composedCanvas = document.createElement("canvas");
  composedCanvas.width = baseMapImage.naturalWidth;
  composedCanvas.height = baseMapImage.naturalHeight;

  const context = composedCanvas.getContext("2d");
  if (context === null) {
    throw new Error("[map-export] Failed to get a canvas context for export composition.");
  }

  context.drawImage(baseMapImage, 0, 0, composedCanvas.width, composedCanvas.height);
  context.drawImage(overlayCanvas, 0, 0, composedCanvas.width, composedCanvas.height);

  return await canvasToBlob(
    typeof args.quality === "number"
      ? {
          canvas: composedCanvas,
          quality: args.quality,
          type: args.type,
        }
      : {
          canvas: composedCanvas,
          type: args.type,
        }
  );
}
