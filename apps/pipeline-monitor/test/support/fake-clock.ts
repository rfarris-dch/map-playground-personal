interface ScheduledTask {
  callback: () => void;
  dueAtMs: number;
  intervalMs: number | null;
}

export class FakeClock {
  private currentNowMs: number;
  private readonly tasks = new Map<number, ScheduledTask>();
  private nextHandle = 1;

  constructor(currentNowMs = Date.parse("2026-03-08T12:00:00.000Z")) {
    this.currentNowMs = currentNowMs;
  }

  advanceBy(delayMs: number): void {
    const targetMs = this.currentNowMs + delayMs;

    while (true) {
      const nextTask = this.findNextTask(targetMs);
      if (nextTask === null) {
        break;
      }

      const { handle, task } = nextTask;
      this.currentNowMs = task.dueAtMs;

      if (task.intervalMs === null) {
        this.tasks.delete(handle);
      } else {
        task.dueAtMs += task.intervalMs;
      }

      task.callback();
    }

    this.currentNowMs = targetMs;
  }

  clearInterval = (handle: number): void => {
    this.tasks.delete(handle);
  };

  clearTimeout = (handle: number): void => {
    this.tasks.delete(handle);
  };

  now(): number {
    return this.currentNowMs;
  }

  pendingTaskCount(): number {
    return this.tasks.size;
  }

  setInterval = (callback: () => void, delayMs: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.tasks.set(handle, {
      callback,
      dueAtMs: this.currentNowMs + delayMs,
      intervalMs: delayMs,
    });
    return handle;
  };

  setTimeout = (callback: () => void, delayMs: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.tasks.set(handle, {
      callback,
      dueAtMs: this.currentNowMs + delayMs,
      intervalMs: null,
    });
    return handle;
  };

  private findNextTask(targetMs: number): {
    readonly handle: number;
    readonly task: ScheduledTask;
  } | null {
    let selectedHandle: number | null = null;
    let selectedTask: ScheduledTask | null = null;

    for (const [handle, task] of this.tasks) {
      if (task.dueAtMs > targetMs) {
        continue;
      }

      if (
        selectedTask === null ||
        task.dueAtMs < selectedTask.dueAtMs ||
        (task.dueAtMs === selectedTask.dueAtMs &&
          (selectedHandle === null || handle < selectedHandle))
      ) {
        selectedHandle = handle;
        selectedTask = task;
      }
    }

    if (selectedTask === null || selectedHandle === null) {
      return null;
    }

    return {
      handle: selectedHandle,
      task: selectedTask,
    };
  }
}
