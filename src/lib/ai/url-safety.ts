// src/lib/ai/url-safety.ts
// Citation/source URLs come from LLM grounding metadata (untrusted). Only absolute http(s) URLs are
// safe to render as a clickable link; anything else (data:, vbscript:, javascript:, mailto:, relative…)
// is dropped at the normalization boundary so NO consumer — server render or client href — ever sees it.

export function isHttpUrl(u: string | undefined): u is string {
  if (u === undefined || u === "") return false;
  try {
    const protocol = new URL(u).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
