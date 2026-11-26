/**
 * Reads the two CSV files Semrush's Site Audit lets you download:
 *
 *   - "issues"       one row per check:  Issue Id, Issue Type, Issue, Failed checks, Total checks, Changed from last audit
 *   - "mega export"  one row per page:   Page URL, then one column per check holding how many times it failed on that page
 *
 * Nothing here talks to Semrush or the network: it only turns the text of a file the admin uploaded into data.
 */

export type SemrushIssueType = "ERROR" | "WARNING" | "NOTICE";

export interface SemrushIssue {
  id: number;
  type: SemrushIssueType;
  name: string;
  failed: number;
  total: number;
  changed: number;
}

export interface SemrushPage {
  url: string;
  /**
   * Only the checks that failed on this page, with how many times. Passed checks are left out. A list rather than an
   * object keyed by check name: names such as "Invalid robots.txt format" contain dots, which make poor database keys.
   */
  issues: Array<{ name: string; count: number }>;
}

export type SemrushFileKind = "issues" | "pages";

/** Largest file accepted. A site audit export is a few hundred KB; this is only a guard against a wrong file. */
export const MAX_CSV_CHARS = 8 * 1024 * 1024;
/** Most pages kept from one mega export (they all go into one database document). */
export const MAX_PAGES = 20_000;

export class SemrushCsvError extends Error {}

/** Lowercase letters and digits only, so "We couldn't open the page?s URL" matches however the quote was mangled. */
export const normalizeName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes, BOM, CRLF. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Which Semrush file this is, from its header row; null when it is neither. */
export function detectSemrushFile(csv: string): SemrushFileKind | null {
  const header = parseCsv(csv.slice(0, 4000).split(/\r?\n/)[0] ?? "")[0] ?? [];
  const first = normalizeName(header[0] ?? "");
  if (first === "issueid" && header.map(normalizeName).includes("failedchecks")) return "issues";
  if (first === "pageurl") return "pages";
  return null;
}

function assertSize(csv: string, label: string): void {
  if (csv.length > MAX_CSV_CHARS) throw new SemrushCsvError(`The ${label} file is too large (over ${MAX_CSV_CHARS / 1024 / 1024} MB).`);
}

const toCount = (value: string | undefined): number => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** "Issues" report: one row per Semrush check. */
export function parseIssuesCsv(csv: string): SemrushIssue[] {
  assertSize(csv, "issues");
  const rows = parseCsv(csv);
  const header = (rows[0] ?? []).map(normalizeName);
  const col = (name: string) => header.indexOf(normalizeName(name));
  const idx = {
    id: col("Issue Id"),
    type: col("Issue Type"),
    name: col("Issue"),
    failed: col("Failed checks"),
    total: col("Total checks"),
    changed: col("Changed from last audit"),
  };
  if (idx.id < 0 || idx.type < 0 || idx.name < 0 || idx.failed < 0 || idx.total < 0) {
    throw new SemrushCsvError(
      "This is not the site audit issues file. It needs the columns: Issue Id, Issue Type, Issue, Failed checks, Total checks.",
    );
  }

  const issues: SemrushIssue[] = [];
  const seen = new Set<number>();
  for (const row of rows.slice(1)) {
    const id = Number.parseInt((row[idx.id] ?? "").trim(), 10);
    const name = (row[idx.name] ?? "").trim();
    if (!Number.isFinite(id) || !name || seen.has(id)) continue;
    const rawType = (row[idx.type] ?? "").trim().toUpperCase();
    const type: SemrushIssueType = rawType === "ERROR" || rawType === "WARNING" ? rawType : "NOTICE";
    seen.add(id);
    issues.push({
      id,
      type,
      name,
      failed: toCount(row[idx.failed]),
      total: toCount(row[idx.total]),
      changed: idx.changed >= 0 ? Number.parseInt((row[idx.changed] ?? "0").trim(), 10) || 0 : 0,
    });
  }
  if (issues.length === 0) throw new SemrushCsvError("The issues file has no rows.");
  return issues;
}

/** "Mega export" report: one row per page, one column per check. */
export function parsePagesCsv(csv: string): SemrushPage[] {
  assertSize(csv, "mega export");
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  if (normalizeName(header[0] ?? "") !== "pageurl" || header.length < 2) {
    throw new SemrushCsvError("This is not the site audit page export. Its first column must be 'Page URL', followed by one column per check.");
  }
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_PAGES) throw new SemrushCsvError(`The mega export has ${dataRows.length} pages; at most ${MAX_PAGES} can be imported.`);

  const pages: SemrushPage[] = [];
  for (const row of dataRows) {
    const url = (row[0] ?? "").trim();
    if (!url) continue;
    const issues: SemrushPage["issues"] = [];
    for (let c = 1; c < header.length; c += 1) {
      const count = toCount(row[c]);
      const name = (header[c] ?? "").trim();
      if (count > 0 && name) issues.push({ name, count });
    }
    pages.push({ url, issues });
  }
  return pages;
}
