#!/usr/bin/env bun

import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT_DIR = path.resolve("var/fema-nfhl-state-downloads");
const DEFAULT_OUTPUT_PATH = path.join(DEFAULT_INPUT_DIR, "nfhl-state-union.vrt");
const DEFAULT_LAYER_NAME = "S_Fld_Haz_Ar";
const NFHL_STATE_ZIP_PATTERN = /^NFHL_\d{2}_\d{8}\.zip$/i;
const ZIP_SUFFIX_PATTERN = /\.zip$/i;

type ArgMap = Readonly<Record<string, string | boolean>>;

type ZipEntry = Readonly<{
  fileName: string;
  filePath: string;
  gdbName: string;
  gdbPath: string;
  productId: string;
}>;

function parseArgs(argv: readonly string[]): ArgMap {
  const entries: Record<string, string | boolean> = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, rawValue] = arg.slice(2).split("=", 2);
    entries[key] = rawValue === undefined ? true : rawValue;
  }

  return entries;
}

function getStringArg(args: ArgMap, key: string): string | null {
  const value = args[key];

  return typeof value === "string" ? value : null;
}

function printHelp(): void {
  console.log(`Build an OGR VRT over downloaded FEMA NFHL state ZIPs.

Usage:
  bun scripts/build-fema-nfhl-vrt.ts [options]

Options:
  --input-dir=/path/to/downloads     Directory containing NFHL_*.zip files
  --output-path=/path/to/output.vrt  Destination VRT path
  --layer-name=S_Fld_Haz_Ar          Source layer to union
  --help                             Show this message
`);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildZipEntries(inputDir: string, fileNames: readonly string[]): readonly ZipEntry[] {
  return fileNames
    .filter((fileName) => NFHL_STATE_ZIP_PATTERN.test(fileName))
    .sort()
    .map((fileName) => {
      const productId = fileName.replace(ZIP_SUFFIX_PATTERN, "");
      const filePath = path.join(inputDir, fileName);
      const gdbName = `${productId}.gdb`;
      const gdbPath = `/vsizip/${filePath}/${gdbName}`;

      return {
        fileName,
        filePath,
        gdbName,
        gdbPath,
        productId,
      };
    });
}

function buildVrtContent(layerName: string, zipEntries: readonly ZipEntry[]): string {
  const layerBlocks = zipEntries
    .map(
      (entry) => `    <OGRVRTLayer name="${escapeXml(entry.productId)}">
      <SrcDataSource relativeToVRT="0">${escapeXml(entry.gdbPath)}</SrcDataSource>
      <SrcLayer>${escapeXml(layerName)}</SrcLayer>
    </OGRVRTLayer>`
    )
    .join("\n");

  return `<OGRVRTDataSource>
  <OGRVRTUnionLayer name="${escapeXml(layerName)}">
    <FieldStrategy>Union</FieldStrategy>
${layerBlocks}
  </OGRVRTUnionLayer>
</OGRVRTDataSource>
`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === true) {
    printHelp();
    return;
  }

  const inputDir = path.resolve(getStringArg(args, "input-dir") ?? DEFAULT_INPUT_DIR);
  const outputPath = path.resolve(getStringArg(args, "output-path") ?? DEFAULT_OUTPUT_PATH);
  const layerName = getStringArg(args, "layer-name") ?? DEFAULT_LAYER_NAME;

  const inputStats = await stat(inputDir);
  if (!inputStats.isDirectory()) {
    throw new Error(`Input path is not a directory: ${inputDir}`);
  }

  const fileNames = await readdir(inputDir);
  const zipEntries = buildZipEntries(inputDir, fileNames);

  if (zipEntries.length === 0) {
    throw new Error(`No NFHL state ZIPs found in ${inputDir}`);
  }

  const vrtContent = buildVrtContent(layerName, zipEntries);
  await writeFile(outputPath, vrtContent, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(`Layer: ${layerName}`);
  console.log(`Sources: ${String(zipEntries.length)}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
