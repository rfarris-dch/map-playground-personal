#!/usr/bin/env bun

import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MSC_ADVANCE_SEARCH_URL = "https://msc.fema.gov/portal/advanceSearch";
const MSC_DOWNLOAD_PRODUCT_URL = "https://msc.fema.gov/portal/downloadProduct";
const DEFAULT_OUTPUT_DIR = path.resolve("var/fema-nfhl-state-downloads");
const TERRITORY_FIPS_CODES = new Set(["60", "66", "69", "72", "75", "78"]);

type ArgMap = Readonly<Record<string, string | boolean>>;

type StateOption = Readonly<{
  fips: string;
  label: string;
}>;

type SearchOption = Readonly<{
  label: string;
  value: string;
}>;

type SearchResponse = Readonly<{
  EFFECTIVE?: Readonly<{
    NFHL_STATE_DATA?: readonly NfhlStateProduct[];
  }>;
}>;

type NfhlStateProduct = Readonly<{
  product_DESCRIPTION?: string | null;
  product_EFFECTIVE_DATE_STRING?: string | null;
  product_FILE_SIZE?: string | null;
  product_NAME: string;
}>;

type DownloadManifestEntry = Readonly<{
  communityValue: string;
  countyValue: string;
  downloadUrl: string;
  effectiveDate: string | null;
  fileName: string;
  filePath: string;
  fileSize: string | null;
  stateFips: string;
  stateLabel: string;
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

function printHelp(): void {
  console.log(`Download FEMA NFHL state geodatabases state by state.

Usage:
  bun scripts/download-fema-nfhl-state-data.ts [options]

Options:
  --output-dir=/abs/or/relative/path   Destination directory. Default: ${DEFAULT_OUTPUT_DIR}
  --states=48,06,Texas,Florida         Restrict download to matching FIPS codes or labels
  --include-territories                Include FEMA territory entries from the MSC state list
  --list-only                          Print resolved products without downloading
  --force                              Re-download files even if they already exist
  --help                               Show this message
`);
}

function getStringArg(args: ArgMap, key: string): string | null {
  const value = args[key];

  return typeof value === "string" ? value : null;
}

function hasFlag(args: ArgMap, key: string): boolean {
  return args[key] === true;
}

function parseCookieHeader(setCookieHeader: string | null): string {
  if (setCookieHeader === null || setCookieHeader.trim() === "") {
    throw new Error("MSC did not return a session cookie.");
  }

  const firstSegment = setCookieHeader.split(",", 1)[0] ?? "";
  const cookiePair = firstSegment.split(";", 1)[0] ?? "";

  if (!cookiePair.includes("=")) {
    throw new Error("MSC session cookie header was malformed.");
  }

  return cookiePair;
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function decodeHtmlValue(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extractSelectOptions(html: string, selectId: string): readonly SearchOption[] {
  const selectPattern = new RegExp(`<select[^>]+id="${selectId}"[\\s\\S]*?<\\/select>`, "i");
  const selectBlockMatch = html.match(selectPattern);

  if (selectBlockMatch === null) {
    throw new Error(`Could not find select #${selectId} in the MSC search page.`);
  }

  const optionPattern = /<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  const options: SearchOption[] = [];

  for (const match of selectBlockMatch[0].matchAll(optionPattern)) {
    const rawValue = match[1] ?? "";
    const rawLabel = match[2] ?? "";
    const label = decodeHtmlValue(rawLabel)
      .replace(/<[^>]+>/g, "")
      .trim();

    options.push({
      label,
      value: decodeHtmlValue(rawValue).trim(),
    });
  }

  return options;
}

function shouldKeepState(option: SearchOption, includeTerritories: boolean): boolean {
  if (option.value === "none") {
    return false;
  }

  if (option.label.includes("DEFUNCT")) {
    return false;
  }

  if (includeTerritories) {
    return true;
  }

  return !TERRITORY_FIPS_CODES.has(option.value);
}

function normalizeStateOptions(
  options: readonly SearchOption[],
  includeTerritories: boolean
): readonly StateOption[] {
  return options
    .filter((option) => shouldKeepState(option, includeTerritories))
    .map((option) => ({
      fips: option.value,
      label: option.label,
    }));
}

function parseRequestedStates(args: ArgMap): readonly string[] {
  const statesArg = getStringArg(args, "states");

  if (statesArg === null) {
    return [];
  }

  return statesArg
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.toUpperCase());
}

function filterStates(
  states: readonly StateOption[],
  requestedStates: readonly string[]
): readonly StateOption[] {
  if (requestedStates.length === 0) {
    return states;
  }

  const requested = new Set(requestedStates);
  const filtered = states.filter(
    (state) => requested.has(state.fips) || requested.has(state.label.toUpperCase())
  );

  if (filtered.length === 0) {
    throw new Error(`No MSC state entries matched --states=${requestedStates.join(",")}.`);
  }

  return filtered;
}

function chooseCommunity(options: readonly SearchOption[]): SearchOption {
  const validOptions = options.filter((option) => option.value !== "none");

  if (validOptions.length === 0) {
    throw new Error("MSC returned no communities for the selected county.");
  }

  const allJurisdictionsOption = validOptions.find(
    (option) => option.label.includes("ALL JURISDICTIONS") || option.value.endsWith("C")
  );

  return allJurisdictionsOption ?? validOptions[0];
}

async function getSessionCookie(): Promise<string> {
  const response = await fetch(MSC_ADVANCE_SEARCH_URL);

  if (!response.ok) {
    throw new Error(`Failed to initialize MSC session: ${response.status} ${response.statusText}`);
  }

  return parseCookieHeader(response.headers.get("set-cookie"));
}

async function fetchStateOptions(
  cookieHeader: string,
  includeTerritories: boolean
): Promise<readonly StateOption[]> {
  const html = await fetchText(MSC_ADVANCE_SEARCH_URL, {
    headers: {
      cookie: cookieHeader,
    },
  });

  const options = extractSelectOptions(html, "selstate");

  return normalizeStateOptions(options, includeTerritories);
}

function fetchCountyOptions(
  cookieHeader: string,
  stateFips: string
): Promise<readonly SearchOption[]> {
  return fetchJson<readonly SearchOption[]>(
    `${MSC_ADVANCE_SEARCH_URL}?getCounty=${encodeURIComponent(stateFips)}`,
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        cookie: cookieHeader,
        "X-Requested-With": "XMLHttpRequest",
      },
    }
  );
}

function fetchCommunityOptions(
  cookieHeader: string,
  stateFips: string,
  countyValue: string
): Promise<readonly SearchOption[]> {
  const searchParams = new URLSearchParams({
    getCommunity: countyValue,
    state: stateFips,
  });

  return fetchJson<readonly SearchOption[]>(
    `${MSC_ADVANCE_SEARCH_URL}?${searchParams.toString()}`,
    {
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        cookie: cookieHeader,
        "X-Requested-With": "XMLHttpRequest",
      },
    }
  );
}

async function fetchNfhlStateProduct(
  cookieHeader: string,
  stateFips: string,
  countyValue: string,
  communityValue: string
): Promise<NfhlStateProduct> {
  const body = new URLSearchParams({
    affiliate: "fema",
    jurisdictionkey: "",
    jurisdictionvalue: "",
    method: "search",
    query: "",
    searchedCid: communityValue,
    searchedDateEnd: "",
    searchedDateStart: "",
    selcommunity: communityValue,
    selcounty: countyValue,
    selstate: stateFips,
    txtenddate: "",
    txtstartdate: "",
    utf8: "✓",
  });

  const response = await fetchJson<SearchResponse>(MSC_ADVANCE_SEARCH_URL, {
    body: body.toString(),
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      cookie: cookieHeader,
      "X-Requested-With": "XMLHttpRequest",
    },
    method: "POST",
  });

  const products = response.EFFECTIVE?.NFHL_STATE_DATA ?? [];

  if (products.length === 0) {
    throw new Error(`MSC returned no NFHL state product for state ${stateFips}.`);
  }

  return products[0];
}

function buildDownloadUrl(productName: string): string {
  const searchParams = new URLSearchParams({
    productID: productName,
    productSubTypeID: "NFHL_STATE_DATA",
    productTypeID: "NFHL",
  });

  return `${MSC_DOWNLOAD_PRODUCT_URL}?${searchParams.toString()}`;
}

async function ensureDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Download failed for ${url}: ${response.status} ${response.statusText}`);
  }

  if (response.body === null) {
    throw new Error(`Download body was empty for ${url}`);
  }

  await ensureDirectory(destinationPath);
  const writable = createWriteStream(destinationPath);
  const readable = Readable.fromWeb(response.body);
  await pipeline(readable, writable);
}

function createManifestEntry(
  outputDir: string,
  state: StateOption,
  countyValue: string,
  communityValue: string,
  product: NfhlStateProduct
): DownloadManifestEntry {
  const fileName = `${product.product_NAME}.zip`;
  const filePath = path.join(outputDir, fileName);

  return {
    communityValue,
    countyValue,
    downloadUrl: buildDownloadUrl(product.product_NAME),
    effectiveDate: product.product_EFFECTIVE_DATE_STRING ?? null,
    fileName,
    filePath,
    fileSize: product.product_FILE_SIZE ?? null,
    stateFips: state.fips,
    stateLabel: state.label,
  };
}

async function writeManifest(
  outputDir: string,
  entries: readonly DownloadManifestEntry[]
): Promise<void> {
  const manifestPath = path.join(outputDir, "manifest.json");
  await ensureDirectory(manifestPath);
  await writeFile(manifestPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (hasFlag(args, "help")) {
    printHelp();
    return;
  }

  const includeTerritories = hasFlag(args, "include-territories");
  const listOnly = hasFlag(args, "list-only");
  const force = hasFlag(args, "force");
  const outputDir = path.resolve(getStringArg(args, "output-dir") ?? DEFAULT_OUTPUT_DIR);
  const requestedStates = parseRequestedStates(args);

  const cookieHeader = await getSessionCookie();
  const discoveredStates = await fetchStateOptions(cookieHeader, includeTerritories);
  const states = filterStates(discoveredStates, requestedStates);
  const manifestEntries: DownloadManifestEntry[] = [];

  await mkdir(outputDir, { recursive: true });

  for (const state of states) {
    console.error(`Resolving NFHL state dataset for ${state.label} (${state.fips})...`);

    const countyOptions = await fetchCountyOptions(cookieHeader, state.fips);
    const county = countyOptions.find((option) => option.value !== "none");

    if (county === undefined) {
      throw new Error(`MSC returned no counties for ${state.label} (${state.fips}).`);
    }

    const communityOptions = await fetchCommunityOptions(cookieHeader, state.fips, county.value);
    const community = chooseCommunity(communityOptions);
    const product = await fetchNfhlStateProduct(
      cookieHeader,
      state.fips,
      county.value,
      community.value
    );
    const manifestEntry = createManifestEntry(
      outputDir,
      state,
      county.value,
      community.value,
      product
    );

    manifestEntries.push(manifestEntry);

    if (listOnly) {
      console.log(
        [
          state.fips,
          state.label,
          manifestEntry.fileName,
          manifestEntry.effectiveDate ?? "",
          manifestEntry.fileSize ?? "",
          manifestEntry.downloadUrl,
        ].join("\t")
      );
      continue;
    }

    const alreadyExists = await fileExists(manifestEntry.filePath);

    if (alreadyExists && !force) {
      console.error(`Skipping existing file ${manifestEntry.filePath}`);
      continue;
    }

    console.error(`Downloading ${manifestEntry.fileName} -> ${manifestEntry.filePath}`);
    await downloadFile(manifestEntry.downloadUrl, manifestEntry.filePath);
  }

  await writeManifest(outputDir, manifestEntries);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
