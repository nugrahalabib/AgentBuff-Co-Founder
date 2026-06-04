import { describe, expect, it } from "vitest";
import { InMemoryObjectStorage, parseDataUrl } from "../../../src/server/storage/object-storage";

describe("parseDataUrl", () => {
  it("decodes a base64 data URL into bytes + content type", () => {
    const out = parseDataUrl("data:image/png;base64,QUJD");
    expect(out?.contentType).toBe("image/png");
    expect(out?.data.toString("utf8")).toBe("ABC");
  });
  it("returns null for a non-data URL", () => {
    expect(parseDataUrl("https://x.id/a.png")).toBeNull();
  });
});

describe("InMemoryObjectStorage", () => {
  it("puts, gets, builds a fetch URL, and deletes", async () => {
    const s = new InMemoryObjectStorage();
    const { ref } = await s.put({ key: "brand/k1/moodboard.png", data: Buffer.from("img"), contentType: "image/png" });
    expect(ref).toBe("brand/k1/moodboard.png");
    expect(s.url(ref)).toBe("/api/storage/brand%2Fk1%2Fmoodboard.png");

    const got = await s.get(ref);
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.toString()).toBe("img");

    await s.delete(ref);
    expect(await s.get(ref)).toBeNull();
  });

  it("records the owner so the serving route can enforce ownership", async () => {
    const s = new InMemoryObjectStorage();
    const { ref } = await s.put({ key: "brand/x.png", data: Buffer.from("i"), contentType: "image/png", ownerUserId: "u1" });
    expect((await s.get(ref))?.ownerUserId).toBe("u1");
  });
});
