import { afterAll, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { DiskObjectStorage } from "../../../src/server/storage/disk-object-storage";

const dir = join(process.cwd(), ".data", "test-storage");

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("DiskObjectStorage", () => {
  it("persists bytes + content type to disk, addressed by an opaque hash ref", async () => {
    const s = new DiskObjectStorage(dir);
    const { ref } = await s.put({ key: "brand/k1/logo.png", data: Buffer.from("PNGDATA"), contentType: "image/png" });
    expect(ref).toMatch(/^[0-9a-f]{64}$/); // sha256 of the key, no path traversal
    expect(s.url(ref)).toBe(`/api/storage/${ref}`);

    const got = await s.get(ref);
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.toString()).toBe("PNGDATA");
  });

  it("is deterministic per key and deletes cleanly", async () => {
    const s = new DiskObjectStorage(dir);
    const a = await s.put({ key: "same", data: Buffer.from("1"), contentType: "text/plain" });
    const b = await s.put({ key: "same", data: Buffer.from("2"), contentType: "text/plain" });
    expect(a.ref).toBe(b.ref); // same key → same ref
    await s.delete(a.ref);
    expect(await s.get(a.ref)).toBeNull();
  });

  it("rejects malformed refs (no path traversal)", async () => {
    const s = new DiskObjectStorage(dir);
    expect(await s.get("../../etc/passwd")).toBeNull();
    expect(await s.get("not-a-hash")).toBeNull();
  });
});
