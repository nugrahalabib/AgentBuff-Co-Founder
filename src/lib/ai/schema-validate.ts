// src/lib/ai/schema-validate.ts — validate LLM JSON output against its JSON Schema before use. PRD §12.5.
// Structured Outputs constrain the model, but we still validate (defense in depth) and trigger one
// repair attempt on mismatch.

import Ajv, { type ValidateFunction } from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });
const cache = new WeakMap<object, ValidateFunction>();

function compile(schema: object): ValidateFunction {
  let validate = cache.get(schema);
  if (validate === undefined) {
    validate = ajv.compile(schema);
    cache.set(schema, validate);
  }
  return validate;
}

export function validateAgainstSchema(data: unknown, schema: object): { ok: true } | { ok: false; errors: string } {
  const validate = compile(schema);
  if (validate(data) === true) return { ok: true };
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()).join("; ");
  return { ok: false, errors: errors || "tidak sesuai schema" };
}

/** Parse JSON then validate against the schema. */
export function parseAndValidate<T>(text: string, schema: object): { ok: true; value: T } | { ok: false; errors: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: "output bukan JSON" };
  }
  const check = validateAgainstSchema(data, schema);
  if (!check.ok) return { ok: false, errors: check.errors };
  return { ok: true, value: data as T };
}
