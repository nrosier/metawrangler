/**
 * Global concurrency limiter for spawned external tools (mkvmerge, ffprobe,
 * mkvpropedit).
 *
 * PERF-02: nothing previously bounded how many of these processes could run
 * at once. A single POST /api/scan/file batch (up to 500 paths) fans out via
 * Promise.allSettled with no throttling, and any number of edit jobs can be
 * running concurrently, each spawning its own subprocess per file — a
 * handful of requests could spawn hundreds of child processes simultaneously
 * and exhaust CPU, memory, file descriptors, and NAS throughput for the
 * whole homelab deployment. This is a self-inflicted DoS risk, not just a
 * performance nit.
 *
 * A single process-wide semaphore here is the simplest fix that actually
 * bounds the real resource (concurrent child processes), regardless of how
 * many requests or jobs are asking for one — it throttles cross-request and
 * cross-job concurrency without needing a dedicated queue per call site.
 */

const MAX_CONCURRENT_TOOL_PROCESSES = 3;

let active = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_TOOL_PROCESSES) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiting.push(() => {
      active++;
      resolve();
    });
  });
}

function release(): void {
  active--;
  const next = waiting.shift();
  if (next) next();
}

/**
 * Run `fn` once a tool-process slot is free. Always releases the slot, even
 * if `fn` throws or rejects.
 */
export async function withToolSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
