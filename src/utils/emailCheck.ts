/*
 * Email address check for the form APIs (same rules as the website forms). Beyond "has an @ and a dot" it checks:
 *  - one @, a part before it, and a domain like example.com / example.co.in
 *  - no spaces, no ".." or a dot at the start / end of the name
 *  - Gmail, Outlook / Hotmail / Live and Yahoo addresses against those providers' own rules
 *  - common typing mistakes ("gmial.com", "gmail.con", "outlok.com") with a suggestion
 * A copy lives in the website (organic_frontend/lib/emailCheck.ts) — keep the two in step.
 */

type Provider = { name: string; local: RegExp; rule: string };

const GMAIL: Provider = {
  name: "Gmail",
  local: /^(?=.{6,30}$)[a-z0-9](?:[a-z0-9.]*[a-z0-9])?$/,
  rule: "Gmail addresses have 6–30 letters, numbers or dots before @gmail.com.",
};
const OUTLOOK: Provider = {
  name: "Outlook",
  local: /^[a-z][a-z0-9._-]{0,63}$/,
  rule: "Outlook / Hotmail addresses start with a letter and use only letters, numbers, dots, hyphens or underscores.",
};
const YAHOO: Provider = {
  name: "Yahoo",
  local: /^[a-z][a-z0-9._]{3,31}$/,
  rule: "Yahoo addresses start with a letter and have 4–32 letters, numbers, dots or underscores.",
};

const PROVIDERS: Record<string, Provider> = {
  "gmail.com": GMAIL,
  "googlemail.com": GMAIL,
  "outlook.com": OUTLOOK,
  "outlook.in": OUTLOOK,
  "hotmail.com": OUTLOOK,
  "hotmail.co.in": OUTLOOK,
  "live.com": OUTLOOK,
  "live.in": OUTLOOK,
  "msn.com": OUTLOOK,
  "yahoo.com": YAHOO,
  "yahoo.co.in": YAHOO,
  "yahoo.in": YAHOO,
  "ymail.com": YAHOO,
};

/** Misspelt provider domains → the intended one */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com", "gnail.com": "gmail.com", "gmali.com": "gmail.com", "gmil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com",
  "gmail.comm": "gmail.com", "gmail.cpm": "gmail.com", "gmail.cmo": "gmail.com", "gmail.in": "gmail.com",
  "gmail.co.in": "gmail.com", "g.mail.com": "gmail.com", "gemail.com": "gmail.com",
  "outlok.com": "outlook.com", "outllok.com": "outlook.com", "otlook.com": "outlook.com", "outloo.com": "outlook.com",
  "outlook.con": "outlook.com", "outlook.co": "outlook.com", "outlook.cm": "outlook.com", "outlook.comm": "outlook.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmil.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.cm": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com", "yahoo.cm": "yahoo.com", "rediffmail.con": "rediffmail.com", "redifmail.com": "rediffmail.com",
  "icloud.con": "icloud.com", "iclod.com": "icloud.com",
};

/** Endings that are almost always ".com" mistyped */
// (.cm, .om and .ni are real country domains, so they are only corrected for the providers above)
const BAD_ENDINGS: [RegExp, string][] = [
  [/\.(con|cmo|comm|cpm|vom|xom)$/, ".com"],
  [/\.inn$/, ".in"],
];

const LOCAL_CHARS = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DOMAIN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/** "" when the address is fine, otherwise what is wrong with it (prefixed with `label`) */
export function emailProblem(raw: string, label = "Email"): string {
  const v = raw.trim().toLowerCase();
  if (!v) return `${label} is required.`;
  if (/\s/.test(v)) return `${label} cannot contain spaces.`;
  if (v.length > 254) return `${label} is too long.`;

  const at = v.split("@");
  if (at.length !== 2) return `${label} must contain exactly one “@”, e.g. name@gmail.com.`;
  const [local, domain] = at;
  if (!local) return `${label} is missing the name before “@”.`;
  if (!domain) return `${label} is missing the domain after “@”, e.g. gmail.com or outlook.com.`;
  if (local.length > 64) return `${label} has too many characters before “@”.`;
  if (!LOCAL_CHARS.test(local)) return `${label} has characters that are not allowed before “@”.`;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return `${label} cannot start or end with a dot, or have two dots together, before “@”.`;
  if (!domain.includes(".")) return `${label} must end with a domain like “.com” or “.in” (e.g. @gmail.com).`;
  if (!DOMAIN.test(domain)) return `${label} has an invalid domain after “@”. It should look like gmail.com or company.co.in.`;

  const fix = TYPOS[domain] || BAD_ENDINGS.reduce<string>((acc, [rx, good]) => acc || (rx.test(domain) ? domain.replace(rx, good) : ""), "");
  if (fix && fix !== domain) return `${label} looks mistyped — did you mean ${local}@${fix}?`;

  const provider = PROVIDERS[domain];
  if (provider && !provider.local.test(local)) return `${label} is not a valid ${provider.name} address. ${provider.rule}`;
  return "";
}

/** Lower-cased, trimmed form to store and send */
export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();
