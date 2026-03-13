import { captureMapImageForExport } from "@/features/app/map-export/map-capture.service";
import type {
  CaptureMapImageArgs,
  ExportMapViewArgs,
  MapImageExportFormat,
  MapViewExportFormat,
} from "@/features/app/map-export/map-export.types";

function extensionForFormat(format: MapViewExportFormat): string {
  if (format === "png") {
    return "png";
  }

  if (format === "pdf") {
    return "pdf";
  }

  return "jpg";
}

function mimeTypeForImageFormat(format: MapImageExportFormat): "image/jpeg" | "image/png" {
  if (format === "png") {
    return "image/png";
  }

  return "image/jpeg";
}

function buildDownloadFilename(filenamePrefix: string, format: MapViewExportFormat): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return `${filenamePrefix}-${timestamp}.${extensionForFormat(format)}`;
}

function toPdfNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function encodePdfChunk(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatenateChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return combined;
}

function buildPdfDocument(args: {
  readonly imageBytes: Uint8Array;
  readonly imageHeight: number;
  readonly imageWidth: number;
  readonly pageHeight: number;
  readonly pageWidth: number;
}): Uint8Array {
  const contentStream = `q\n${toPdfNumber(args.pageWidth)} 0 0 ${toPdfNumber(args.pageHeight)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encodePdfChunk(contentStream);
  const chunks: Uint8Array[] = [encodePdfChunk("%PDF-1.4\n%\u0080\u0080\u0080\u0080\n")];
  const objectOffsets = [0];

  const pdfObjects: readonly Uint8Array[] = [
    encodePdfChunk("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encodePdfChunk("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    encodePdfChunk(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${toPdfNumber(args.pageWidth)} ${toPdfNumber(args.pageHeight)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    ),
    concatenateChunks([
      encodePdfChunk(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(args.imageWidth))} /Height ${Math.max(1, Math.round(args.imageHeight))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${args.imageBytes.length} >>\nstream\n`
      ),
      args.imageBytes,
      encodePdfChunk("\nendstream\nendobj\n"),
    ]),
    concatenateChunks([
      encodePdfChunk(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      encodePdfChunk("endstream\nendobj\n"),
    ]),
  ];

  for (const pdfObject of pdfObjects) {
    objectOffsets.push(chunks.reduce((length, chunk) => length + chunk.length, 0));
    chunks.push(pdfObject);
  }

  const xrefOffset = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const xrefEntries = objectOffsets
    .map((offset, index) => {
      if (index === 0) {
        return "0000000000 65535 f \n";
      }

      return `${offset.toString().padStart(10, "0")} 00000 n \n`;
    })
    .join("");

  chunks.push(
    encodePdfChunk(
      `xref\n0 ${objectOffsets.length}\n${xrefEntries}trailer\n<< /Size ${objectOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    )
  );

  return concatenateChunks(chunks);
}

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadLink.click();
  URL.revokeObjectURL(url);
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

async function createPdfBlobFromCapturedImage(
  blob: Blob,
  pageSize: { readonly height: number; readonly width: number }
): Promise<Blob> {
  const [imageBytes, image] = await Promise.all([blob.arrayBuffer(), loadBlobImage(blob)]);
  const pdfBytes = buildPdfDocument({
    imageBytes: new Uint8Array(imageBytes),
    imageHeight: image.naturalHeight,
    imageWidth: image.naturalWidth,
    pageHeight: pageSize.height,
    pageWidth: pageSize.width,
  });

  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

export function captureMapImage(args: CaptureMapImageArgs): Promise<Blob> {
  const type = mimeTypeForImageFormat(args.format);
  const captureOptions =
    args.format === "jpeg" && typeof args.quality === "number"
      ? {
          type,
          quality: args.quality,
        }
      : {
          type,
        };

  return captureMapImageForExport({
    captureOptions,
    map: args.map,
  });
}

export async function exportMapView(args: ExportMapViewArgs): Promise<void> {
  if (args.format === "pdf") {
    const capturedBlob = await captureMapImage(
      typeof args.quality === "number"
        ? {
            format: "jpeg",
            map: args.map,
            quality: args.quality,
          }
        : {
            format: "jpeg",
            map: args.map,
          }
    );
    const pdfBlob = await createPdfBlobFromCapturedImage(capturedBlob, args.map.getCanvasSize());
    downloadBlobFile(pdfBlob, buildDownloadFilename(args.filenamePrefix ?? "map-view", "pdf"));
    return;
  }

  const capturedBlob = await captureMapImage(
    typeof args.quality === "number"
      ? {
          format: args.format,
          map: args.map,
          quality: args.quality,
        }
      : {
          format: args.format,
          map: args.map,
        }
  );

  downloadBlobFile(
    capturedBlob,
    buildDownloadFilename(args.filenamePrefix ?? "map-view", args.format)
  );
}
