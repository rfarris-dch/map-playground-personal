import {
  createMap,
  createMapLibreAdapter,
  type IMap,
  type MapCaptureImageOptions,
  registerPmtilesProtocol,
} from "@map-migration/map-engine";

const EXPORT_MAP_LOAD_TIMEOUT_MS = 15_000;
const HIDDEN_EXPORT_OFFSET_PX = -20_000;

function createHiddenExportContainer(size: {
  readonly height: number;
  readonly width: number;
}): HTMLDivElement {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = `${String(HIDDEN_EXPORT_OFFSET_PX)}px`;
  container.style.top = "0";
  container.style.width = `${String(Math.max(1, Math.round(size.width)))}px`;
  container.style.height = `${String(Math.max(1, Math.round(size.height)))}px`;
  container.style.pointerEvents = "none";
  container.style.contain = "strict";
  document.body.append(container);
  return container;
}

async function waitForAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

async function waitForMapIdle(map: IMap): Promise<void> {
  await waitForMapEvent(
    map,
    "idle",
    "[map-export] Timed out waiting for export map to become idle."
  );
}

async function waitForMapLoad(map: IMap): Promise<void> {
  await waitForMapEvent(map, "load", "[map-export] Timed out waiting for export map to load.");
}

async function waitForMapEvent(
  map: IMap,
  event: "idle" | "load",
  timeoutMessage: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutHandle = 0;

    const onEvent = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutHandle);
      map.off(event, onEvent);
      resolve();
    };

    timeoutHandle = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      map.off(event, onEvent);
      reject(new Error(timeoutMessage));
    }, EXPORT_MAP_LOAD_TIMEOUT_MS);

    map.on(event, onEvent);
  });
}

function cloneMapStyle(map: IMap) {
  return structuredClone(map.getStyle());
}

function mirrorRuntimeImages(sourceMap: IMap, exportMap: IMap): void {
  for (const imageId of sourceMap.listImageIds()) {
    if (exportMap.hasImage(imageId)) {
      continue;
    }

    const imageData = sourceMap.getImageData(imageId);
    if (imageData === null) {
      continue;
    }

    exportMap.addImage(imageId, imageData);
  }
}

async function withTemporaryExportMap<T>(
  sourceMap: IMap,
  run: (map: IMap) => Promise<T>
): Promise<T> {
  const size = sourceMap.getCanvasSize();
  const container = createHiddenExportContainer(size);
  const disposePmtilesProtocol = registerPmtilesProtocol();
  const exportMap = createMap(createMapLibreAdapter(), container, {
    bearing: sourceMap.getBearing(),
    center: sourceMap.getCenter(),
    pitch: sourceMap.getPitch(),
    preserveDrawingBuffer: true,
    projection: sourceMap.getProjection(),
    style: cloneMapStyle(sourceMap),
    zoom: sourceMap.getZoom(),
  });

  try {
    await waitForMapLoad(exportMap);
    mirrorRuntimeImages(sourceMap, exportMap);
    exportMap.triggerRepaint();
    await waitForMapIdle(exportMap);
    await waitForAnimationFrame();
    return await run(exportMap);
  } finally {
    exportMap.destroy();
    disposePmtilesProtocol();
    container.remove();
  }
}

export function captureMapImageForExport(args: {
  readonly captureOptions?: MapCaptureImageOptions;
  readonly map: IMap;
}): Promise<Blob> {
  return withTemporaryExportMap(args.map, (exportMap) => {
    return exportMap.captureImage(args.captureOptions);
  });
}
