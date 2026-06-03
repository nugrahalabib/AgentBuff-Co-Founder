// src/lib/html/sanitize.ts — HTML escaping for Template-Constrained Generation. PRD §9.5.2.1, §13.3.
// The LLM fills TEXT slots only (never HTML); the server owns all markup. Every interpolated slot is
// HTML-escaped here so a malicious/garbled slot value cannot inject tags, scripts, or break the template.
// Pure + deterministic → unit-tested.

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a string for safe insertion into HTML text or a double-quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch]!);
}

/** Escape, then convert newlines to <br> for multi-line slot text. */
export function escapeMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** Escape each item of a list and join (e.g. bullet text). */
export function escapeList(values: unknown[]): string[] {
  return values.map((v) => escapeHtml(v));
}

/**
 * Defense-in-depth: strip ALL tags from a string (used if a value might already contain markup).
 * Removes <script>/<style> blocks entirely (including content), then any remaining tags, then escapes.
 */
export function stripTags(value: unknown): string {
  const withoutBlocks = String(value ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  const withoutTags = withoutBlocks.replace(/<\/?[a-z][^>]*>/gi, "");
  return escapeHtml(withoutTags);
}

/** Allow only http(s) URLs; anything else (javascript:, data:, …) collapses to "#". */
export function safeUrl(url: unknown): string {
  const s = String(url ?? "").trim();
  return /^https?:\/\//i.test(s) ? escapeHtml(s) : "#";
}
