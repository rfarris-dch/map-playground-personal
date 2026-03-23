#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";

const manifestPath = new URL(
  "../apps/web/src/features/facilities/provider-logo-map.json",
  import.meta.url
);
const bucketName = process.env.PROVIDER_LOGO_BUCKET ?? "dch-playground-tiles";
const awsProfile = process.env.AWS_PROFILE ?? "nonprod";
const cmsBaseUrl = process.env.CMS_BASE_URL ?? "https://www.datacenterhawk.com";
const cmsBucketFallbacks = [
  { bucketName: "dch-prod-blc-cms", awsProfile: "prod" },
  { bucketName: "test-blc-cms", awsProfile: "nonprod" },
  { bucketName: "dev-blc-cms", awsProfile: "nonprod" },
];
const tempDir = mkdtempSync(join(tmpdir(), "provider-logo-sync-"));

const preferredLogoNames = [
  "logo.svg",
  "logo.png",
  "logo.webp",
  "logo.jpg",
  "logo.jpeg",
  "logo.ico",
];
const bucketLogoPathPattern = /provider-logos\/([^/]+)\/(.+)$/;
const cmsStaticPrefixPattern = /^\/cmsstatic\//;
const knownPlaceholderLogoUrls = new Set(["/img/eye.png"]);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function getMapProviderIds() {
  const sql = `
WITH ids AS (
  SELECT DISTINCT provider_id::text AS provider_id
  FROM serve.facility_site
  WHERE provider_id IS NOT NULL
  UNION
  SELECT DISTINCT provider_id::text AS provider_id
  FROM serve.hyperscale_site
  WHERE provider_id IS NOT NULL
)
SELECT provider_id
FROM ids
ORDER BY provider_id;
`;

  return run("psql", ["-d", "dch_os", "-At", "-c", sql])
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSourceLogosByProviderId() {
  const sql = `
SELECT provider_id, logo_url
FROM (
  SELECT
    CAST(p.PROVIDER_PROFILE_ID AS CHAR) AS provider_id,
    COALESCE(
      MAX(CASE WHEN pm.MAP_KEY = 'mapLogo' THEN m.URL END),
      MAX(CASE WHEN pm.MAP_KEY = 'squareLogo' THEN m.URL END),
      MAX(CASE WHEN pm.MAP_KEY = 'primary' THEN m.URL END)
    ) AS logo_url
  FROM HAWK_PROVIDER_PROFILE p
  LEFT JOIN HAWK_PROVIDER_MEDIA_MAP pm
    ON pm.HAWK_PROVIDER_ID = p.PROVIDER_PROFILE_ID
    AND pm.ARCHIVED = 'N'
  LEFT JOIN BLC_MEDIA m
    ON m.MEDIA_ID = pm.MEDIA_ID
  WHERE p.ARCHIVED = 'N' AND p.SNDBX_ID IS NULL
  GROUP BY p.PROVIDER_PROFILE_ID

  UNION ALL

  SELECT
    CAST(p.ID AS CHAR) AS provider_id,
    COALESCE(
      MAX(CASE WHEN pm.MAP_KEY = 'mapLogo' THEN m.URL END),
      MAX(CASE WHEN pm.MAP_KEY = 'clusterLogo' THEN m.URL END),
      MAX(CASE WHEN pm.MAP_KEY = 'primary' THEN m.URL END)
    ) AS logo_url
  FROM HYPERSCALE_PROVIDER p
  LEFT JOIN HYPERSCALE_PROVIDER_MEDIA_MAP pm
    ON pm.HYPERSCALE_PROVIDER_ID = p.ID
    AND pm.ARCHIVED = 'N'
  LEFT JOIN BLC_MEDIA m
    ON m.MEDIA_ID = pm.MEDIA_ID
  WHERE p.ARCHIVED = 'N' AND p.SNDBX_ID IS NULL
  GROUP BY p.ID
) logos
WHERE logo_url IS NOT NULL AND logo_url != '';
`;

  const rows = run("mysql", ["-u", "root", "-N", "-B", "hawksuite", "-e", sql]).split("\n");
  const logosById = new Map();

  for (const row of rows) {
    if (!row) {
      continue;
    }

    const [providerId, logoUrl] = row.split("\t");
    if (!(providerId && logoUrl) || logosById.has(providerId)) {
      continue;
    }

    logosById.set(providerId, logoUrl);
  }

  return logosById;
}

function getBucketFilesByProviderId() {
  const output = run("aws", [
    "s3",
    "ls",
    `s3://${bucketName}/provider-logos/`,
    "--recursive",
    "--profile",
    awsProfile,
  ]);

  const filesByProviderId = new Map();
  for (const line of output.split("\n")) {
    const match = line.match(bucketLogoPathPattern);
    if (!match) {
      continue;
    }

    const [, providerId, fileName] = match;
    const current = filesByProviderId.get(providerId) ?? [];
    current.push(fileName);
    filesByProviderId.set(providerId, current);
  }

  return filesByProviderId;
}

function sortFileNames(fileNames) {
  return [...fileNames].sort((left, right) => left.localeCompare(right));
}

function chooseManifestFileName(fileNames, currentManifestFileName, sourceLogoUrl) {
  const sortedFileNames = sortFileNames(fileNames);
  if (currentManifestFileName && sortedFileNames.includes(currentManifestFileName)) {
    return currentManifestFileName;
  }

  for (const preferredName of preferredLogoNames) {
    if (sortedFileNames.includes(preferredName)) {
      return preferredName;
    }
  }

  const sourceBaseName = sourceLogoUrl
    ? basename(new URL(sourceLogoUrl, cmsBaseUrl).pathname)
    : null;
  if (sourceBaseName && sortedFileNames.includes(sourceBaseName)) {
    return sourceBaseName;
  }

  const imageFileName = sortedFileNames.find((fileName) => {
    return [".svg", ".png", ".webp", ".jpg", ".jpeg", ".ico"].includes(
      extname(fileName).toLowerCase()
    );
  });

  return imageFileName ?? sortedFileNames[0] ?? null;
}

function buildCmsUrl(sourceLogoUrl) {
  if (sourceLogoUrl.startsWith("http://") || sourceLogoUrl.startsWith("https://")) {
    return sourceLogoUrl;
  }

  const encodedPath = sourceLogoUrl
    .split("/")
    .map((segment, index) => {
      if (index === 0) {
        return segment;
      }

      return encodeURIComponent(segment);
    })
    .join("/");

  return `${cmsBaseUrl}${encodedPath}`;
}

function downloadLogo(sourceLogoUrl, destinationPath) {
  const cmsUrl = buildCmsUrl(sourceLogoUrl);
  try {
    run("curl", ["-fL", "--silent", "--show-error", cmsUrl, "-o", destinationPath]);
    return true;
  } catch {
    if (!sourceLogoUrl.startsWith("/cmsstatic/")) {
      return false;
    }

    const cmsBucketKey = sourceLogoUrl.replace(cmsStaticPrefixPattern, "");
    for (const fallback of cmsBucketFallbacks) {
      try {
        run("aws", [
          "s3",
          "cp",
          `s3://${fallback.bucketName}/${cmsBucketKey}`,
          destinationPath,
          "--profile",
          fallback.awsProfile,
        ]);
        return true;
      } catch {
        // Fall through to the next bucket candidate.
      }
    }

    return false;
  }
}

function uploadLogo(localPath, providerId, targetFileName) {
  run("aws", [
    "s3",
    "cp",
    localPath,
    `s3://${bucketName}/provider-logos/${providerId}/${targetFileName}`,
    "--profile",
    awsProfile,
  ]);
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function writeManifest(manifest) {
  const sortedEntries = Object.entries(manifest).sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true })
  );
  const nextManifest = Object.fromEntries(sortedEntries);
  writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
}

function main() {
  const providerIds = getMapProviderIds();
  const sourceLogosByProviderId = getSourceLogosByProviderId();
  const bucketFilesByProviderId = getBucketFilesByProviderId();
  const manifest = readManifest();

  let uploadedCount = 0;
  let updatedManifestCount = 0;
  let alreadyPresentCount = 0;
  let missingSourceCount = 0;
  let failedDownloadCount = 0;

  const missingSourceProviderIds = [];
  const failedDownloadProviderIds = [];

  for (const providerId of providerIds) {
    let bucketFiles = bucketFilesByProviderId.get(providerId) ?? [];
    const sourceLogoUrl = sourceLogosByProviderId.get(providerId) ?? null;

    if (bucketFiles.length === 0) {
      if (sourceLogoUrl === null || knownPlaceholderLogoUrls.has(sourceLogoUrl)) {
        missingSourceCount += 1;
        missingSourceProviderIds.push(providerId);
        continue;
      }

      const logoExtension = extname(new URL(sourceLogoUrl, cmsBaseUrl).pathname).toLowerCase();
      const targetFileName = logoExtension ? `logo${logoExtension}` : "logo";
      const localLogoPath = join(tempDir, `${providerId}${logoExtension || ".bin"}`);
      const downloaded = downloadLogo(sourceLogoUrl, localLogoPath);

      if (!downloaded) {
        failedDownloadCount += 1;
        failedDownloadProviderIds.push(providerId);
        continue;
      }

      uploadLogo(localLogoPath, providerId, targetFileName);
      bucketFiles = [targetFileName];
      bucketFilesByProviderId.set(providerId, bucketFiles);
      uploadedCount += 1;
    } else {
      alreadyPresentCount += 1;
    }

    const nextManifestFileName = chooseManifestFileName(
      bucketFiles,
      manifest[providerId],
      sourceLogoUrl
    );
    if (nextManifestFileName !== null && manifest[providerId] !== nextManifestFileName) {
      manifest[providerId] = nextManifestFileName;
      updatedManifestCount += 1;
    }
  }

  writeManifest(manifest);

  console.log(
    JSON.stringify(
      {
        providerIds: providerIds.length,
        uploadedCount,
        updatedManifestCount,
        alreadyPresentCount,
        missingSourceCount,
        failedDownloadCount,
        missingSourceProviderIds: missingSourceProviderIds.slice(0, 50),
        failedDownloadProviderIds: failedDownloadProviderIds.slice(0, 50),
      },
      null,
      2
    )
  );
}

try {
  main();
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
