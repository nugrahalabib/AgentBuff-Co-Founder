import { describe, expect, it } from "vitest";
import { toStrictJsonSchema } from "../../../src/lib/ai/openai-adapter";

describe("toStrictJsonSchema (OpenAI strict mode coercion, PRD §12.15)", () => {
  it("adds additionalProperties:false and lists every property in required", () => {
    const input = { type: "object", properties: { a: { type: "string" }, b: { type: "number" } }, required: ["a"] };
    expect(toStrictJsonSchema(input)).toEqual({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      additionalProperties: false,
      required: ["a", "b"],
    });
  });

  it("recurses into nested objects and array items", () => {
    const input = {
      type: "object",
      properties: { items: { type: "array", items: { type: "object", properties: { x: { type: "number" } } } } },
    };
    const out = toStrictJsonSchema(input) as {
      additionalProperties: boolean;
      required: string[];
      properties: { items: { items: { additionalProperties: boolean; required: string[] } } };
    };
    expect(out.additionalProperties).toBe(false);
    expect(out.required).toEqual(["items"]);
    expect(out.properties.items.items.additionalProperties).toBe(false);
    expect(out.properties.items.items.required).toEqual(["x"]);
  });

  it("is idempotent on an already-strict schema", () => {
    const strict = { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false };
    expect(toStrictJsonSchema(strict)).toEqual(strict);
  });

  it("leaves non-object schemas untouched", () => {
    expect(toStrictJsonSchema({ type: "string" })).toEqual({ type: "string" });
    expect(toStrictJsonSchema(null)).toBeNull();
  });
});
