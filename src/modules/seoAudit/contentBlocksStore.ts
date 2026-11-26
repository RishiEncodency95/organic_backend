/**
 * The website's page text, as stored in the CMS (Pages & CMS), split into blocks: one block per text field.
 *
 * "Humanize" works on THESE blocks and nothing else: it takes the exact text of a field, rewrites it, and writes it
 * back into the same field, so what the website shows is the saved text, character for character. Nothing here
 * invents content. Text that is not in the CMS (it lives in the website's code) is not listed: it cannot be changed from
 * the admin, and the admin is told so.
 */
import * as sitePagesService from "../sitePages/sitePages.service";
import * as home2Service from "../home2/home2.service";
import { HOME2_SECTION_KEYS, type Home2SectionKey } from "../home2/home2.defaults";
import { sitePageKeyForPath } from "./pageSeoStore";

export interface ContentBlock {
  /** "<section>:<path to the field>", for example "hero:stats.0.text" */
  id: string;
  section: string;
  path: string[];
  /** Readable place of the text on the page, for example "Hero › stats #1 › text" */
  label: string;
  kind: "heading" | "paragraph" | "short";
  text: string;
  words: number;
  chars: number;
  lineBreaks: number;
}

export class ContentBlockError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Fields that are not page copy: pictures, links, ids, colours, dates, codes */
const SKIP_KEY = /^(id|_id|key|slug|icon|iconImage|iconAlt|image|imageUrl|imageAlt|backgroundImage|backgroundImageAlt|bgImage|alt|thumbnail|logo|cardImage|heroImage|href|url|link|ctaLink|buttonLink|videoUrl|embedUrl|mapUrl|target|anchor|className|color|bgColor|textColor|phone|email|whatsapp|date|publishedAt|updatedAt|createdAt|status|type|related|schemaMarkup|metaTitle|metaDescription|isActive|order|sortOrder|successMessage|errorMessage|services)$|Alt$|Image$|Url$|Link$|Href$|Placeholder$/i;

const HEADING_KEY = /(^|\.)(title|heading|headline|name|label)$/i;

const humanLabel = (section: string, path: string[]): string => {
  const cap = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  const parts = path.map((p, i) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : i === path.length - 1 ? p : p));
  return [cap(section), ...parts].join(" › ");
};

const isProse = (raw: string): boolean => {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 20) return false;
  if (t.split(" ").length < 4) return false;
  if (/^(https?:|\/|#|mailto:|tel:|data:)/i.test(t)) return false;
  if (/<[a-z!/][^>]*>/i.test(raw)) return false; // markup inside: not touched
  if (/\|\s*\//.test(t)) return false; // "Name | /link": data, not copy
  const letters = (t.match(/[A-Za-zऀ-ॿ]/g) || []).length;
  return letters / t.length >= 0.55;
};

function collect(section: string, value: unknown, path: string[], out: ContentBlock[]): void {
  if (typeof value === "string") {
    const last = path[path.length - 1] ?? "";
    if (SKIP_KEY.test(last)) return;
    if (!isProse(value)) return;
    const dotted = path.join(".");
    out.push({
      id: `${section}:${dotted}`,
      section,
      path,
      label: humanLabel(section, path),
      kind: HEADING_KEY.test(dotted) ? "heading" : value.length < 70 ? "short" : "paragraph",
      text: value,
      words: value.replace(/\s+/g, " ").trim().split(" ").length,
      chars: value.length,
      lineBreaks: (value.match(/\n/g) || []).length,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collect(section, v, [...path, String(i)], out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEY.test(k) && typeof v !== "object") continue;
      collect(section, v, [...path, k], out);
    }
  }
}

interface LoadedPage {
  kind: "home2" | "page";
  key: string;
  sections: Record<string, any>;
}

export async function loadSections(route: string): Promise<LoadedPage> {
  const key = sitePageKeyForPath(route);
  if (!key) throw new ContentBlockError(`${route} has no editable text in the CMS (its text is in the website's code).`, 404);
  if (key === "home2") {
    const page: any = await home2Service.getPage();
    return { kind: "home2", key, sections: page.sections ?? {} };
  }
  const page: any = await sitePagesService.getPage(key);
  return { kind: "page", key, sections: page.sections ?? {} };
}

/** Every text field of the page that is real copy, in page order. Switched-off sections are left out. */
export async function listBlocks(route: string): Promise<{ pageKey: string; blocks: ContentBlock[] }> {
  const { key, sections } = await loadSections(route);
  const blocks: ContentBlock[] = [];
  for (const [section, data] of Object.entries(sections)) {
    if (data && typeof data === "object" && (data as any).isActive === false) continue;
    collect(section, data, [], blocks);
  }
  return { pageKey: key, blocks };
}

export const parseBlockId = (id: string): { section: string; path: string[] } => {
  const i = id.indexOf(":");
  if (i < 1) throw new ContentBlockError("Invalid block id.");
  const section = id.slice(0, i);
  const path = id.slice(i + 1).split(".");
  if (!path.length || path.some((p) => !p || p === "__proto__" || p === "constructor" || p === "prototype")) throw new ContentBlockError("Invalid block id.");
  return { section, path };
};

const readAt = (root: any, path: string[]): unknown => path.reduce((o, k) => (o != null && typeof o === "object" ? o[k] : undefined), root);

export async function readBlock(route: string, blockId: string): Promise<{ block: ContentBlock; pageKey: string }> {
  const { pageKey, blocks } = await listBlocks(route);
  const block = blocks.find((b) => b.id === blockId);
  if (!block) throw new ContentBlockError("That text block was not found on this page (it may have been changed).", 404);
  return { block, pageKey };
}

/**
 * Writes `text` into the one field. When `mustBe` is given, the field must still hold exactly that text (nobody changed
 * it since it was read), otherwise nothing is written (409).
 */
export async function writeBlock(route: string, blockId: string, text: string, mustBe: string | null, by?: string): Promise<{ previous: string }> {
  const { section, path } = parseBlockId(blockId);
  const loaded = await loadSections(route);
  const current = loaded.sections[section];
  if (!current || typeof current !== "object") throw new ContentBlockError("That section no longer exists.", 404);
  const now = readAt(current, path);
  if (typeof now !== "string") throw new ContentBlockError("That text field no longer exists.", 404);
  if (mustBe !== null && now !== mustBe) throw new ContentBlockError("This text was changed after you opened it. Reload the page and try again.", 409);

  // only the one field changes; the rest of the section is saved back exactly as it is
  const copy = JSON.parse(JSON.stringify(current));
  let parent = copy;
  for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]];
  parent[path[path.length - 1]] = text;
  delete copy._id;

  if (loaded.kind === "home2") {
    if (!(HOME2_SECTION_KEYS as readonly string[]).includes(section)) throw new ContentBlockError("Unknown section.", 400);
    await home2Service.updateSection(section as Home2SectionKey, copy, by);
  } else {
    await sitePagesService.updateSection(loaded.key, section, copy, by);
  }
  return { previous: now };
}
