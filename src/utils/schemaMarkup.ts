/**
 * Schema markup (JSON-LD) as an admin pastes it, in any of these forms:
 *   { ... }                                              plain JSON
 *   <script> { ... } </script>                           with a plain script tag
 *   <script type="application/ld+json"> { ... } </script>  with the JSON-LD script tag
 * and several such blocks one after another. Returns the JSON alone (one object, or an array when
 * several blocks were pasted), pretty-printed, so the website always gets clean JSON to put in its
 * own <script type="application/ld+json"> tag. "" for empty input, null when it is not valid JSON.
 */
export const normalizeSchemaMarkup = (raw: string): string | null => {
  const input = (raw ?? "").trim();
  if (!input) return "";

  const scripts = [...input.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
  // No closing tag: an opening <script ...> (or a stray </script>) around the JSON
  const blocks = scripts.length ? scripts : [input.replace(/<\/?script\b[^>]*>/gi, "")];

  const parsed: unknown[] = [];
  for (const block of blocks) {
    const text = block.trim();
    if (!text) continue;
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== "object") return null;
      parsed.push(...(Array.isArray(value) ? value : [value]));
    } catch {
      return null;
    }
  }
  if (!parsed.length) return null;
  return JSON.stringify(parsed.length === 1 ? parsed[0] : parsed, null, 2);
};

/** An SEO save with its schema markup stored as clean JSON (the body was already validated) */
export const withCleanSchema = <T extends Record<string, unknown>>(seo: T): T =>
  typeof seo.schemaMarkup === "string"
    ? { ...seo, schemaMarkup: normalizeSchemaMarkup(seo.schemaMarkup) ?? seo.schemaMarkup }
    : seo;

/**
 * What is wrong with schema markup an admin typed, in plain words (null when it is fine): it must be valid JSON-LD and
 * every block must say what it describes (an @type, or an @graph of such items).
 */
export const schemaProblem = (raw: string): string | null => {
  const clean = normalizeSchemaMarkup(raw);
  if (clean === null) return "The schema is not valid JSON. Check the commas, quotes and brackets.";
  if (clean === "") return "The schema is empty.";
  const value = JSON.parse(clean);
  const items: unknown[] = Array.isArray(value) ? value : [value];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as Record<string, unknown> | null;
    if (!it || typeof it !== "object") return `Schema ${i + 1} is not an object.`;
    const hasType = typeof it["@type"] === "string" || Array.isArray(it["@type"]);
    const graph = it["@graph"];
    if (!hasType && !(Array.isArray(graph) && graph.length)) return `Schema ${i + 1} has no "@type" (what it describes, for example "Organization" or "FAQPage").`;
    if (!it["@context"] && !hasType) return `Schema ${i + 1} has no "@context".`;
  }
  return null;
};
