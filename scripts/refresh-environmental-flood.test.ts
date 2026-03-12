import { afterEach, describe, expect, it } from "bun:test";
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectGeoJsonSequenceGrowth,
  reconcileArcgisNormalizeSequenceOutput,
  resolveNextArcgisGeometryBatchSize,
  validateArcgisNormalizeSequenceOutputIntegrity,
} from "./refresh-environmental-flood";

function buildFeatureLine(objectId: number): string {
  return `${JSON.stringify({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-97.8, 30.2],
          [-97.7, 30.2],
          [-97.7, 30.3],
          [-97.8, 30.2],
        ],
      ],
    },
    properties: {
      OBJECTID: objectId,
    },
  })}\n`;
}

describe("refresh-environmental-flood resume reconciliation", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir.length > 0) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = "";
    }
  });

  it("truncates back to the last committed byte boundary before resuming the same run", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-resume-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(1);
    const secondLine = buildFeatureLine(2);
    const thirdLine = buildFeatureLine(3);

    writeFileSync(
      outputPath,
      `${firstLine}${secondLine}${thirdLine.slice(0, Math.max(1, thirdLine.length - 7))}`,
      "utf8"
    );

    const reconciledProgress = await reconcileArcgisNormalizeSequenceOutput(outputPath, {
      geometryBatchSize: 25,
      lastObjectId: 1,
      outputBytes: Buffer.byteLength(firstLine),
      pageSize: 500,
      processedCount: 1,
      skippedObjectIds: [],
      skippedCount: 0,
      updatedAt: "2026-03-10T12:00:00Z",
      writtenCount: 1,
    });

    expect(reconciledProgress?.outputBytes).toBe(Buffer.byteLength(firstLine));
    expect(readFileSync(outputPath, "utf8")).toBe(firstLine);

    appendFileSync(outputPath, `${secondLine}${thirdLine}`, "utf8");

    const parsedFeatures = readFileSync(outputPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { properties?: { OBJECTID?: number } });

    expect(parsedFeatures).toHaveLength(3);
    expect(parsedFeatures.map((feature) => feature.properties?.OBJECTID)).toEqual([1, 2, 3]);
  });

  it("repairs legacy progress files that only know the committed line count", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-legacy-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(10);
    const secondLine = buildFeatureLine(20);

    writeFileSync(outputPath, `${firstLine}${secondLine}${secondLine}`, "utf8");

    const reconciledProgress = await reconcileArcgisNormalizeSequenceOutput(outputPath, {
      geometryBatchSize: 25,
      lastObjectId: 10,
      outputBytes: 0,
      pageSize: 500,
      processedCount: 1,
      skippedObjectIds: [],
      skippedCount: 0,
      updatedAt: "2026-03-10T12:00:00Z",
      writtenCount: 1,
    });

    expect(reconciledProgress?.outputBytes).toBe(Buffer.byteLength(firstLine));
    expect(readFileSync(outputPath, "utf8")).toBe(firstLine);
  });

  it("repairs stale written counts against the durable byte boundary before resuming", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-counter-repair-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(100);

    writeFileSync(outputPath, firstLine, "utf8");

    const reconciledProgress = await reconcileArcgisNormalizeSequenceOutput(outputPath, {
      geometryBatchSize: 25,
      lastObjectId: 100,
      outputBytes: Buffer.byteLength(firstLine),
      pageSize: 500,
      processedCount: 2,
      skippedObjectIds: [],
      skippedCount: 0,
      updatedAt: "2026-03-10T12:00:00Z",
      writtenCount: 2,
    });

    expect(reconciledProgress).toMatchObject({
      outputBytes: Buffer.byteLength(firstLine),
      processedCount: 1,
      writtenCount: 1,
    });
  });

  it("fails integrity validation when durable line counts disagree with checkpoint counters", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-integrity-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(200);

    writeFileSync(outputPath, firstLine, "utf8");

    await expect(
      validateArcgisNormalizeSequenceOutputIntegrity({
        outputPath,
        progress: {
          geometryBatchSize: 25,
          lastObjectId: 200,
          outputBytes: Buffer.byteLength(firstLine),
          pageSize: 500,
          processedCount: 2,
          skippedObjectIds: [],
          skippedCount: 0,
          updatedAt: "2026-03-10T12:00:00Z",
          writtenCount: 2,
        },
        requireCompleteCount: true,
        totalCount: 1,
      })
    ).rejects.toThrow("writtenCount=2");
  });

  it("fails integrity validation when normalize completion is short of the expected feature count", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-total-count-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(300);

    writeFileSync(outputPath, firstLine, "utf8");

    await expect(
      validateArcgisNormalizeSequenceOutputIntegrity({
        outputPath,
        progress: {
          geometryBatchSize: 25,
          lastObjectId: 300,
          outputBytes: Buffer.byteLength(firstLine),
          pageSize: 500,
          processedCount: 1,
          skippedObjectIds: [],
          skippedCount: 0,
          updatedAt: "2026-03-10T12:00:00Z",
          writtenCount: 1,
        },
        requireCompleteCount: true,
        totalCount: 2,
      })
    ).rejects.toThrow("featureCount=2");
  });

  it("counts only newline-terminated sequence rows when tracking local normalize growth", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "flood-normalize-growth-"));
    const outputPath = join(tempDir, "flood-hazard.geojsonl");
    const firstLine = buildFeatureLine(400);
    const secondLine = buildFeatureLine(401);

    writeFileSync(
      outputPath,
      `${firstLine}${secondLine.slice(0, Math.max(1, secondLine.length - 5))}`
    );

    const firstGrowth = await inspectGeoJsonSequenceGrowth(outputPath, 0);
    expect(firstGrowth).toEqual({
      lineCountDelta: 1,
      outputBytes: Buffer.byteLength(firstLine),
    });

    appendFileSync(
      outputPath,
      `${secondLine.slice(Math.max(1, secondLine.length - 5))}${buildFeatureLine(402)}`
    );

    const secondGrowth = await inspectGeoJsonSequenceGrowth(outputPath, firstGrowth.outputBytes);
    expect(secondGrowth.lineCountDelta).toBe(2);
    expect(secondGrowth.outputBytes).toBe(statSync(outputPath).size);
  });

  it("ramps geometry batch size back up after a successful singleton batch", () => {
    expect(resolveNextArcgisGeometryBatchSize(1, 200)).toBe(2);
    expect(resolveNextArcgisGeometryBatchSize(2, 200)).toBe(4);
    expect(resolveNextArcgisGeometryBatchSize(4, 200)).toBe(8);
    expect(resolveNextArcgisGeometryBatchSize(16, 200)).toBe(25);
  });

  it("caps recovered geometry batch size by the remaining object count", () => {
    expect(resolveNextArcgisGeometryBatchSize(1, 1)).toBe(1);
    expect(resolveNextArcgisGeometryBatchSize(1, 2)).toBe(2);
    expect(resolveNextArcgisGeometryBatchSize(12, 7)).toBe(7);
  });
});
