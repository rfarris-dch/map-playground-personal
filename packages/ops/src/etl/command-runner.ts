import { Command } from "@effect/platform";
import type * as CommandExecutor from "@effect/platform/CommandExecutor";
import { BunContext } from "@effect/platform-bun";
import { all, type Effect, gen, map, scoped } from "effect/Effect";
import { make } from "effect/ManagedRuntime";
import { runFold, type Stream } from "effect/Stream";
import type {
  ManagedCommandProcess,
  RunBufferedCommandOptions,
  RunBufferedCommandResult,
  RunCommandOutputOptions,
} from "./command-runner.types";

const DEFAULT_CAPTURE_MAX_BYTES = 2_000_000;
const TRAILING_CR_RE = /\r$/;
const commandRuntime = make(BunContext.layer);
const supportedSignals: readonly CommandExecutor.Signal[] = [
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGBREAK",
  "SIGLOST",
  "SIGINFO",
];

interface OutputCaptureState {
  readonly capturedBytes: number;
  readonly output: string;
  readonly pendingLine: string;
  readonly truncated: boolean;
}

function emitCompleteLines(
  pending: string,
  emitLine: ((line: string) => void) | undefined
): string {
  if (typeof emitLine !== "function") {
    return pending;
  }

  let pendingLine = pending;
  while (true) {
    const newLineIndex = pendingLine.indexOf("\n");
    if (newLineIndex === -1) {
      return pendingLine;
    }

    const line = pendingLine.slice(0, newLineIndex).replace(TRAILING_CR_RE, "");
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0) {
      emitLine(trimmedLine);
    }

    pendingLine = pendingLine.slice(newLineIndex + 1);
  }
}

function appendCapturedOutput(
  state: OutputCaptureState,
  chunk: Uint8Array,
  decoded: string,
  captureMaxBytes: number
): OutputCaptureState {
  if (state.capturedBytes < captureMaxBytes) {
    const remainingBytes = captureMaxBytes - state.capturedBytes;
    if (chunk.byteLength <= remainingBytes) {
      return {
        ...state,
        output: state.output + decoded,
        capturedBytes: state.capturedBytes + chunk.byteLength,
      };
    }

    const partial = chunk.subarray(0, remainingBytes);
    const partialText = new TextDecoder().decode(partial);
    return {
      ...state,
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

function isSupportedSignal(signal: string): signal is CommandExecutor.Signal {
  return supportedSignals.some((candidate) => candidate === signal);
}

function normalizeSignal(signal?: number | string): CommandExecutor.Signal | undefined {
  if (typeof signal === "string" && isSupportedSignal(signal)) {
    return signal;
  }

  return undefined;
}

function readStreamOutput(
  stream: Stream<Uint8Array, unknown>,
  options: RunCommandOutputOptions | undefined
): Effect<string, unknown> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const captureMaxBytes = options?.captureMaxBytes ?? DEFAULT_CAPTURE_MAX_BYTES;
  const initialState: OutputCaptureState = {
    capturedBytes: 0,
    output: "",
    pendingLine: "",
    truncated: false,
  };

  return runFold(stream, initialState, (state, chunk) => {
    if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) {
      return state;
    }

    const decoded = decoder.decode(chunk, {
      stream: true,
    });

    return appendCapturedOutput(
      {
        ...state,
        pendingLine: emitCompleteLines(state.pendingLine + decoded, options?.onLine),
      },
      chunk,
      decoded,
      captureMaxBytes
    );
  }).pipe(
    map((state) => {
      const flushed = decoder.decode();
      const withFlush =
        flushed.length > 0
          ? appendCapturedOutput(
              {
                ...state,
                pendingLine: state.pendingLine + flushed,
              },
              encoder.encode(flushed),
              flushed,
              captureMaxBytes
            )
          : state;

      const finalPendingLine = withFlush.pendingLine.replace(TRAILING_CR_RE, "");
      const trimmedPendingLine = finalPendingLine.trim();
      if (trimmedPendingLine.length > 0) {
        options?.onLine?.(trimmedPendingLine);
      }

      if (withFlush.truncated) {
        return `${withFlush.output}\n[truncated after ${String(captureMaxBytes)} bytes]`;
      }

      return withFlush.output;
    })
  );
}

export async function runBufferedCommand(
  options: RunBufferedCommandOptions
): Promise<RunBufferedCommandResult> {
  const startedAt = Date.now();
  const args = options.args ?? [];
  let command = Command.make(options.command, ...args);

  if (typeof options.cwd === "string" && options.cwd.length > 0) {
    command = Command.workingDirectory(command, options.cwd);
  }

  if (options.env) {
    command = Command.env(command, options.env);
  }

  const program = scoped(
    gen(function* () {
      const process = yield* Command.start(command);
      const exited = commandRuntime.runPromise(map(process.exitCode, Number));
      const managedProcess: ManagedCommandProcess = {
        exited,
        kill: (signal) => {
          commandRuntime.runPromise(process.kill(normalizeSignal(signal))).catch(() => undefined);
        },
      };

      options.onProcessStart?.(managedProcess);

      try {
        const [exitCode, stdout, stderr] = yield* all(
          [
            map(process.exitCode, Number),
            readStreamOutput(process.stdout, options.stdout),
            readStreamOutput(process.stderr, options.stderr),
          ],
          {
            concurrency: "unbounded",
          }
        );

        return {
          durationMs: Date.now() - startedAt,
          exitCode,
          stderr,
          stdout,
        };
      } finally {
        options.onProcessExit?.();
      }
    })
  );

  return commandRuntime.runPromise(program);
}
