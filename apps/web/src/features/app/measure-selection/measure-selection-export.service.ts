import { captureMapImageForExport } from "@/features/app/map-export/map-capture.service";
import type { ExportMeasureSelectionImageArgs } from "@/features/app/measure-selection/measure-selection-export.service.types";
import { buildMeasureSelectionCsv } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import { downloadCsvFile } from "@/lib/csv-download.service";

const SELECTION_EXPORT_PADDING_PX = 24;
const SELECTION_STROKE_STYLE = "#0e7490";
const SELECTION_STROKE_WIDTH_PX = 2.25;
const SELECTION_STROKE_DASH = [2, 1];

function imageExtensionForType(type: "image/png" | "image/jpeg"): string {
  if (type === "image/png") {
    return "png";
  }

  return "jpg";
}

function buildImageDownloadFilename(
  filenamePrefix: string,
  imageType: "image/png" | "image/jpeg"
): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return `${filenamePrefix}-${timestamp}.${imageExtensionForType(imageType)}`;
}

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.click();
  URL.revokeObjectURL(url);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function resolveSelectionExportScale(
  args: Pick<ExportMeasureSelectionImageArgs, "map">,
  image: HTMLImageElement
): {
  readonly strokeScale: number;
  readonly x: number;
  readonly y: number;
} {
  const canvasSize = args.map.getCanvasSize();
  if (canvasSize.width <= 0 || canvasSize.height <= 0) {
    throw new Error("[map] Invalid map canvas size for export.");
  }

  const scaleX = image.naturalWidth / canvasSize.width;
  const scaleY = image.naturalHeight / canvasSize.height;

  return {
    x: scaleX,
    y: scaleY,
    strokeScale: Math.max(scaleX, scaleY),
  };
}

function projectSelectionVertices(
  args: Pick<ExportMeasureSelectionImageArgs, "map" | "selectionRing">,
  scale: ReturnType<typeof resolveSelectionExportScale>
): readonly (readonly [number, number])[] {
  return args.selectionRing.map((vertex) => {
    const [x, y] = args.map.project(vertex);
    return [x * scale.x, y * scale.y] as const;
  });
}

function resolveSelectionExportBounds(
  projectedVertices: readonly (readonly [number, number])[],
  args: {
    readonly imageHeight: number;
    readonly imageWidth: number;
    readonly paddingPx: number;
  }
): {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of projectedVertices) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const left = clamp(Math.floor(minX - args.paddingPx), 0, args.imageWidth - 1);
  const right = clamp(Math.ceil(maxX + args.paddingPx), left + 1, args.imageWidth);
  const top = clamp(Math.floor(minY - args.paddingPx), 0, args.imageHeight - 1);
  const bottom = clamp(Math.ceil(maxY + args.paddingPx), top + 1, args.imageHeight);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

async function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(blob);

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("[map] Failed to load captured map image."));
    };
    image.src = imageUrl;
  });
}

async function exportCanvasToBlob(
  canvas: HTMLCanvasElement,
  imageType: "image/png" | "image/jpeg",
  quality?: number
): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("[map] Failed to crop captured map image."));
          return;
        }

        resolve(blob);
      },
      imageType,
      quality
    );
  });
}

async function cropSelectionImage(
  args: ExportMeasureSelectionImageArgs,
  capturedBlob: Blob,
  imageType: "image/png" | "image/jpeg"
): Promise<Blob> {
  const image = await loadBlobImage(capturedBlob);
  const exportScale = resolveSelectionExportScale(args, image);
  const projectedVertices = projectSelectionVertices(args, exportScale);
  const paddingPx = SELECTION_EXPORT_PADDING_PX * exportScale.strokeScale;
  const bounds = resolveSelectionExportBounds(projectedVertices, {
    imageWidth: image.naturalWidth,
    imageHeight: image.naturalHeight,
    paddingPx,
  });
  const canvas = document.createElement("canvas");
  canvas.width = bounds.width;
  canvas.height = bounds.height;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("[map] Failed to create export canvas context.");
  }

  if (imageType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, bounds.width, bounds.height);
  }

  const relativeVertices = projectedVertices.map(
    ([x, y]) => [x - bounds.left, y - bounds.top] as const
  );
  const strokeWidthPx = SELECTION_STROKE_WIDTH_PX * exportScale.strokeScale;
  const strokeDash = SELECTION_STROKE_DASH.map((segment) => segment * exportScale.strokeScale);

  if (args.subject === "selection-with-area") {
    context.save();
    context.beginPath();
    relativeVertices.forEach(([relativeX, relativeY], index) => {
      if (index === 0) {
        context.moveTo(relativeX, relativeY);
        return;
      }

      context.lineTo(relativeX, relativeY);
    });
    context.closePath();
    context.clip();

    context.drawImage(
      image,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    context.restore();
  }

  context.save();
  context.beginPath();
  relativeVertices.forEach(([relativeX, relativeY], index) => {
    if (index === 0) {
      context.moveTo(relativeX, relativeY);
      return;
    }

    context.lineTo(relativeX, relativeY);
  });
  context.closePath();
  context.setLineDash(strokeDash);
  context.lineWidth = strokeWidthPx;
  context.strokeStyle = SELECTION_STROKE_STYLE;
  context.stroke();
  context.restore();

  return exportCanvasToBlob(canvas, imageType, args.quality);
}

export function exportMeasureSelectionSummary(
  measureSelectionSummary: MeasureSelectionSummary | null
): void {
  if (measureSelectionSummary === null || measureSelectionSummary.totalCount === 0) {
    return;
  }

  const csv = buildMeasureSelectionCsv(measureSelectionSummary);
  downloadCsvFile(csv, "map-selection");
}

export async function exportMeasureSelectionImage(
  args: ExportMeasureSelectionImageArgs
): Promise<void> {
  const imageType = args.format ?? "image/png";

  const captureOptions =
    typeof args.quality === "number"
      ? {
          type: imageType,
          quality: args.quality,
        }
      : {
          type: imageType,
        };

  const capturedBlob = await captureMapImageForExport({
    captureOptions,
    map: args.map,
  });
  const blob = await cropSelectionImage(args, capturedBlob, imageType);

  downloadBlobFile(
    blob,
    buildImageDownloadFilename(args.filenamePrefix ?? "map-selection", imageType)
  );
}
