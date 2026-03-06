import { randomBytes } from "node:crypto";
import type {
  ParcelsSyncConfig,
  ParcelsSyncRunReason,
  ParcelsSyncRunResult,
} from "@/sync/parcels-sync.types";
import type {
  OutputCaptureState,
  ReadStreamOptions,
  RunSyncScriptHooks,
} from "./process-stream-execution.service.types";

declare const Bun: {
  spawn(options: {
    cmd: readonly string[];
    cwd?: string;
    env?: Record<string, string>;
    stderr?: "inherit" | "pipe";
    stdout?: "inherit" | "pipe";
  }): {
    exited: Promise<number>;
    kill(signal?: number | string): void;
    stderr: ReadableStream<Uint8Array> | null;
    stdout: ReadableStream<Uint8Array> | null;
  };
};

const SYNC_OUTPUT_CAPTURE_MAX_BYTES = 2_000_000;
const TRAILING_CR_RE = /\r$/;
const ISO_REMOVE_PUNCTUATION_RE = /[-:]/g;
const ISO_MILLIS_SUFFIX_RE = /\.\d{3}Z$/;

function copyProcessEnvironment(
  runId: string,
  runReason: ParcelsSyncRunReason
): Record<string, string> {
  const env = Object.entries(process.env).reduce<Record<string, string>>(
    (nextEnv, [key, value]) => {
      if (typeof value === "string") {
        nextEnv[key] = value;
      }
      return nextEnv;
    },
    {}
  );
  env.RUN_ID = runId;
  env.RUN_REASON = runReason;
  return env;
}

function emitCompleteLines(pending: string, emitLine: (line: string) => void): string {
  let pendingLine = pending;
  while (true) {
    const newLineIndex = pendingLine.indexOf("\n");
    if (newLineIndex === -1) {
      return pendingLine;
    }

    const line = pendingLine.slice(0, newLineIndex).replace(TRAILING_CR_RE, "");
    emitLine(line);
    pendingLine = pendingLine.slice(newLineIndex + 1);
  }
}

function appendCapturedOutput(
  state: OutputCaptureState,
  chunk: Uint8Array,
  decoded: string
): OutputCaptureState {
  if (state.capturedBytes < SYNC_OUTPUT_CAPTURE_MAX_BYTES) {
    const remainingBytes = SYNC_OUTPUT_CAPTURE_MAX_BYTES - state.capturedBytes;
    if (chunk.byteLength <= remainingBytes) {
      return {
        output: state.output + decoded,
        capturedBytes: state.capturedBytes + chunk.byteLength,
        truncated: state.truncated,
      };
    }

    const partial = chunk.subarray(0, remainingBytes);
    const partialText = new TextDecoder().decode(partial);
    return {
      output: state.output + partialText,
      capturedBytes: state.capturedBytes + remainingBytes,
      truncated: true,
    };
  }

  return {
    ...state,
    truncated: true,
  };
}

async function readStream(
  stream: ReadableStream<Uint8Array> | null,
  options: ReadStreamOptions = {}
): Promise<string> {
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pendingLine = "";
  let captureState: OutputCaptureState = {
    output: "",
    capturedBytes: 0,
    truncated: false,
  };

  const emitLine = (line: string): void => {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      return;
    }

    if (options.onLine) {
      options.onLine(trimmedLine);
    }
  };

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }

    const chunk = result.value;
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) {
      continue;
    }

    const decoded = decoder.decode(chunk, {
      stream: true,
    });
    pendingLine = emitCompleteLines(pendingLine + decoded, emitLine);
    captureState = appendCapturedOutput(captureState, chunk, decoded);
  }

  const flushDecoded = decoder.decode();
  if (flushDecoded.length > 0) {
    pendingLine += flushDecoded;
    captureState = appendCapturedOutput(
      captureState,
      new TextEncoder().encode(flushDecoded),
      flushDecoded
    );
  }

  if (pendingLine.trim().length > 0) {
    emitLine(pendingLine.replace(TRAILING_CR_RE, ""));
  }

  if (captureState.truncated) {
    return `${captureState.output}\n[truncated after ${String(SYNC_OUTPUT_CAPTURE_MAX_BYTES)} bytes]`;
  }

  return captureState.output;
}

export async function runSyncScript(
  config: ParcelsSyncConfig,
  runId: string,
  runReason: ParcelsSyncRunReason,
  onLine: (line: string) => void,
  hooks: RunSyncScriptHooks = {}
): Promise<ParcelsSyncRunResult> {
  const startedAt = Date.now();
  const child = Bun.spawn({
    cmd: ["bash", config.syncScriptPath],
    cwd: config.projectRoot,
    env: copyProcessEnvironment(runId, runReason),
    stderr: "pipe",
    stdout: "pipe",
  });
  hooks.onProcessStart?.(child);

  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      readStream(child.stdout, { onLine }),
      readStream(child.stderr, { onLine }),
    ]);

    return {
      durationMs: Date.now() - startedAt,
      exitCode,
      stderr,
      stdout,
    };
  } finally {
    hooks.onProcessExit?.();
  }
}

export function summarizeOutput(result: ParcelsSyncRunResult): string {
  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    return stderr;
  }

  const lines = result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "no output";
  }

  const tailLines = lines.slice(-6);
  return tailLines.join(" | ");
}

export function createManagedRunId(reason: ParcelsSyncRunReason): string {
  const iso = new Date().toISOString();
  const normalized = iso.replace(ISO_REMOVE_PUNCTUATION_RE, "").replace(ISO_MILLIS_SUFFIX_RE, "Z");
  const suffix = randomBytes(3).toString("hex");
  return `auto-${reason}-${normalized}-${suffix}`;
}
