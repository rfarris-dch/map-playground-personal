import { spawn } from "node:child_process";
import { extname } from "node:path";

const DEFAULT_PROVIDER_LOGO_BUCKET = process.env.PROVIDER_LOGO_BUCKET ?? "dch-playground-tiles";
const DEFAULT_AWS_PROFILE = (process.env.AWS_PROFILE ?? "").trim();
const DEFAULT_CACHE_CONTROL = "public, max-age=86400";

interface ProviderLogoObject {
  readonly body: Uint8Array;
  readonly cacheControl: string;
  readonly contentType: string;
}

const providerLogoCache = new Map<string, ProviderLogoObject>();

function resolveContentType(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".ico") {
    return "image/x-icon";
  }

  return "application/octet-stream";
}

function readS3Object(objectKey: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const args = ["s3", "cp", `s3://${DEFAULT_PROVIDER_LOGO_BUCKET}/${objectKey}`, "-"];
    if (DEFAULT_AWS_PROFILE.length > 0) {
      args.push("--profile", DEFAULT_AWS_PROFILE);
    }

    const process = spawn("aws", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    process.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    process.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    process.on("error", reject);
    process.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(Buffer.concat(stderrChunks).toString("utf8").trim() || "aws s3 cp failed")
        );
        return;
      }

      resolve(new Uint8Array(Buffer.concat(stdoutChunks)));
    });
  });
}

export async function getProviderLogoObject(
  providerId: string,
  fileName: string
): Promise<ProviderLogoObject | null> {
  const objectKey = `provider-logos/${providerId}/${fileName}`;
  const cached = providerLogoCache.get(objectKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const body = await readS3Object(objectKey);
    const nextObject: ProviderLogoObject = {
      body,
      contentType: resolveContentType(fileName),
      cacheControl: DEFAULT_CACHE_CONTROL,
    };
    providerLogoCache.set(objectKey, nextObject);
    return nextObject;
  } catch {
    return null;
  }
}
