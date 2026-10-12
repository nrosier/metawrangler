import { describe, it, expect } from "vitest";
import { withToolSlot } from "../toolConcurrency.js";

/** Resolves after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("withToolSlot", () => {
  it("never runs more than 3 callers concurrently", async () => {
    let current = 0;
    let maxConcurrent = 0;

    const task = () =>
      withToolSlot(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await delay(10);
        current--;
      });

    await Promise.all(Array.from({ length: 10 }, task));

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it("releases the slot even when the callback throws", async () => {
    await expect(
      withToolSlot(() => Promise.reject(new Error("boom")))
    ).rejects.toThrow("boom");

    // If the slot weren't released, this would hang forever waiting on the
    // semaphore (10 tasks > the limit of 3) — the test's own timeout would
    // catch a regression here.
    let ran = 0;
    await Promise.all(
      Array.from({ length: 10 }, () => withToolSlot(() => Promise.resolve(ran++)))
    );
    expect(ran).toBe(10);
  });
});
