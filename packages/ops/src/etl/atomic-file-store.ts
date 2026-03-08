import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { JsonDecoder } from "./atomic-file-store.types";

function createAtomicTempPath(path: string): string {
  return `${path}.tmp-${process.pid}-${Date.now()}`;
}

function decodeJsonText<T>(
  path: string,
  raw: string,
  decode: JsonDecoder<T>,
  allowEmpty: boolean
): T | null {
  if (raw.trim().length === 0) {
    if (allowEmpty) {
      return null;
    }

    throw new Error(`Expected JSON content at ${path}`);
  }

  return decode(JSON.parse(raw));
}

export function ensureDirectory(path: string): void {
  mkdirSync(path, {
    recursive: true,
  });
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function copyFileEnsuringDirectory(sourcePath: string, destinationPath: string): void {
  ensureDirectory(dirname(destinationPath));
  cpSync(sourcePath, destinationPath);
}

export function writeTextAtomic(path: string, content: string): void {
  ensureDirectory(dirname(path));
  const tempPath = createAtomicTempPath(path);
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, path);
}

export function writeJsonAtomic(path: string, value: unknown): void {
  writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readJson<T>(path: string, decode: JsonDecoder<T>): T {
  const decoded = decodeJsonText(path, readText(path), decode, false);
  if (decoded === null) {
    throw new Error(`Expected JSON content at ${path}`);
  }

  return decoded;
}

export function readJsonOption<T>(path: string, decode: JsonDecoder<T>): T | null {
  if (!fileExists(path)) {
    return null;
  }

  return decodeJsonText(path, readText(path), decode, true);
}
