import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../../../src/server/jobs/job-queue";

function makeQueue() {
  let n = 0;
  let t = 0;
  return new InMemoryJobQueue(() => `job-${++n}`, () => `t-${++t}`);
}

describe("InMemoryJobQueue", () => {
  it("enqueues, runs the handler async, records progress, and completes", async () => {
    const q = makeQueue();
    const { id } = await q.enqueue(async (onProgress) => {
      onProgress({ stage: "step-1", percent: 50 });
      return { value: 42 };
    });
    expect(id).toBe("job-1");

    const done = await q.waitFor(id);
    expect(done?.status).toBe("completed");
    expect((done?.result as { value: number }).value).toBe(42);
    expect(done?.progress).toEqual({ stage: "step-1", percent: 50 });
  });

  it("captures a failed job's error without throwing to the enqueuer", async () => {
    const q = makeQueue();
    const { id } = await q.enqueue(async () => {
      throw new Error("boom");
    });
    const done = await q.waitFor(id);
    expect(done?.status).toBe("failed");
    expect(done?.error).toBe("boom");
  });

  it("returns null for an unknown job", async () => {
    expect(await makeQueue().get("nope")).toBeNull();
  });
});
