import type { AIAnalysisOutput } from "./openai.service";

/*
 * Rule-based CV scorer, used when neither OpenAI nor Gemini answers.
 * It reads the CV text for real evidence — years of experience, the job's skills (with
 * common synonyms), degree level and field, domain words, the job's requirements and the
 * location — so different CVs get different scores and reasons.
 */

export interface LocalJob {
  title: string;
  department: string;
  location: string;
  experienceMin: number;
  experienceMax: number;
  skills: string[];
  requirements: string[];
  responsibilities: string[];
  educationRequirements?: string;
}

// Words that say nothing about fit on their own
const STOP = new Set(
  "a an and or the of in on for to with from by at as is are be this that these those our your their its it we you they years year yrs experience experienced strong good excellent proven ability able related field degree knowledge understanding skills skill working work plus etc including such using use well best practices detail details attention minimum preferred required must should will have has".split(
    " "
  )
);

/** Concrete words a CV uses for the job's broad skill names */
const SKILL_SYNONYMS: Record<string, string[]> = {
  "javascript frameworks": ["react", "react.js", "reactjs", "next.js", "nextjs", "angular", "vue", "vue.js", "node.js", "nodejs", "express", "svelte", "javascript", "typescript"],
  "restful apis": ["rest api", "restful", "rest apis", "api development", "apis", "express", "fastapi", "django rest", "graphql", "postman"],
  "database management": ["mongodb", "mysql", "postgresql", "postgres", "sql", "database", "firebase", "redis", "oracle", "mongoose", "prisma"],
  "version control systems": ["git", "github", "gitlab", "bitbucket", "version control", "svn"],
  "responsive design": ["responsive", "tailwind", "bootstrap", "css", "media queries", "mobile-first", "mobile first", "flexbox", "sass"],
  "talent acquisition": ["talent acquisition", "recruitment", "recruiting", "recruiter", "hiring", "sourcing", "onboarding", "headhunting", "interviews"],
  "employee relations": ["employee relations", "employee engagement", "grievance", "engagement", "industrial relations", "conflict resolution"],
  "performance management": ["performance management", "appraisal", "appraisals", "kpi", "kra", "performance review", "okr"],
  "training development": ["training", "learning and development", "l&d", "upskilling", "training and development", "workshops"],
  "hr strategy": ["hr strategy", "hr policies", "hr policy", "workforce planning", "hrbp", "hr business partner", "organizational development"],
};

/** Domain words per department / role family, for "industry experience" */
const DOMAIN_WORDS: { match: RegExp; words: string[] }[] = [
  {
    match: /technolog|\bit\b|software|developer|engineer|full stack|frontend|backend/i,
    words: ["software", "developer", "web development", "software development", "web", "frontend", "front-end", "backend", "back-end", "full stack", "full-stack", "programming", "javascript", "typescript", "react", "node", "api", "database", "html", "css", "git", "software engineer", "web application", "web app"],
  },
  {
    match: /human resource|\bhr\b|people|talent|workforce/i,
    words: ["human resources", "hr", "recruitment", "recruiting", "talent", "payroll", "onboarding", "employee", "hiring", "hrms", "compliance", "labour", "labor", "appraisal", "training", "policies"],
  },
  {
    match: /sales|business development|marketing|exhibition|sponsor/i,
    words: ["sales", "business development", "b2b", "client", "clients", "lead generation", "revenue", "targets", "exhibition", "trade show", "sponsorship", "negotiation", "crm", "marketing", "accounts"],
  },
  {
    match: /finance|account/i,
    words: ["accounting", "accounts", "tally", "gst", "audit", "finance", "taxation", "ledger", "balance sheet", "reconciliation"],
  },
];

/** Degree fields a requirement may name, and how CVs write them */
const FIELD_SYNONYMS: { match: RegExp; words: string[] }[] = [
  { match: /computer science|information technology|\bcs\b|\bit\b|computer/i, words: ["computer science", "computer", "information technology", "b.tech", "btech", "b.e", "bca", "mca", "m.tech", "mtech", "software", "cse", "b.sc it", "bsc it"] },
  { match: /\bhr\b|human resource/i, words: ["human resource", "human resources", "hr", "hrm", "personnel", "psychology", "industrial relations"] },
  { match: /marketing|business|commerce/i, words: ["marketing", "business", "mba", "bba", "pgdm", "commerce", "b.com", "bcom", "management"] },
];

const DEGREE_LEVELS: { level: number; label: string; pattern: RegExp }[] = [
  { level: 3, label: "Postgraduate degree", pattern: /\b(mba|pgdm|m\.?\s?tech|m\.?\s?e\b|mca|m\.?\s?sc|m\.?\s?com|m\.?\s?a\b|master'?s?|post\s?graduat|ph\.?d)/i },
  { level: 2, label: "Bachelor's degree", pattern: /\b(b\.?\s?tech|b\.?\s?e\b|bca|b\.?\s?sc|b\.?\s?com|bba|b\.?\s?a\b|bachelor'?s?|graduat(e|ion)|degree)/i },
  { level: 1, label: "Diploma / 12th", pattern: /\b(diploma|12th|xii|higher secondary|intermediate|polytechnic)/i },
];

const EDUCATION_LINE =
  /\b(b\.?\s?tech|b\.?\s?e\b|bca|mca|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|bba|mba|pgdm|b\.?\s?a\b|m\.?\s?a\b|m\.?\s?tech|bachelor|master|diploma|school|college|university|institute|cgpa|gpa|percentage|12th|10th|class\s+(x|xii|10|12)|ph\.?d|graduat)/i;

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const lower = (s: string) => s.toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word / whole-phrase presence, so "java" does not match "javascript" */
const hasTerm = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(lower(term))}($|[^a-z0-9])`, "i").test(text);

// Spellings and plurals that mean the same word
const VARIANTS: Record<string, string[]> = { labor: ["labour"], labour: ["labor"], organization: ["organisation"], organisation: ["organization"] };
const tokenForms = (t: string) => [t, ...(t.length > 3 && t.endsWith("s") ? [t.slice(0, -1)] : []), ...(VARIANTS[t] ?? [])];

const significantTokens = (phrase: string) =>
  lower(phrase)
    .replace(/[^a-z0-9.+#\s-]/g, " ")
    .split(/[\s/-]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));

/** Terms that prove one job skill: its synonyms, or its own significant words */
const termsForSkill = (skill: string) => {
  const key = lower(skill).trim();
  return SKILL_SYNONYMS[key] ?? [key, ...significantTokens(skill)];
};

/** Years of work experience: the larger of a stated figure and the date ranges in the CV */
export function estimateYears(cv: string): number {
  const text = lower(cv);
  let stated = 0;
  for (const m of text.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp|work)/g)) {
    stated = Math.max(stated, parseFloat(m[1]));
  }

  const now = new Date();
  const ranges: [number, number][] = [];
  const range = new RegExp(`(?:(${MONTHS})[a-z]*\\.?\\s*)?((?:19|20)\\d{2})\\s*(?:-|–|—|to|till|until)\\s*(?:(?:(${MONTHS})[a-z]*\\.?\\s*)?((?:19|20)\\d{2})|(present|current|now|till date|date|ongoing))`, "g");
  const monthIndex = (m?: string) => (m ? Math.max(0, MONTHS.split("|").findIndex((x) => m.startsWith(x.slice(0, 3)))) % 12 : 0);
  for (const m of text.matchAll(range)) {
    // Education lines also carry year ranges; skip a range whose own line names a degree or school
    const lineStart = text.lastIndexOf("\n", m.index ?? 0) + 1;
    const lineEndAt = text.indexOf("\n", (m.index ?? 0) + m[0].length);
    const line = text.slice(lineStart, lineEndAt === -1 ? undefined : lineEndAt);
    if (EDUCATION_LINE.test(line)) continue;
    const start = parseInt(m[2], 10) + monthIndex(m[1]) / 12;
    const end = m[5] ? now.getFullYear() + now.getMonth() / 12 : parseInt(m[4], 10) + monthIndex(m[3]) / 12;
    if (end >= start && end - start < 40) ranges.push([start, end]);
  }
  // Merge overlapping jobs so parallel roles are not counted twice
  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of ranges) {
    if (!cur || r[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [r[0], r[1]];
    } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0];

  return Math.round(Math.max(stated, total) * 10) / 10;
}

/** First line that looks like a person's name */
function guessName(cv: string): string | null {
  for (const line of cv.split(/\r?\n/).slice(0, 8)) {
    const t = line.replace(/^(name|resume|curriculum vitae|cv)\s*[:\-]?\s*/i, "").trim();
    if (/^[A-Za-z][A-Za-z.' ]{2,40}$/.test(t) && t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 4) {
      return t
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }
  return null;
}

export function analyzeCvLocally(
  cvText: string,
  job: LocalJob,
  contact: { email: string | null; phone: string | null; phones: string[]; linkedin: string | null }
): AIAnalysisOutput {
  const cv = lower(cvText);

  // ── Skills ──
  const jobSkills = job.skills.length ? job.skills : job.requirements.flatMap(significantTokens).slice(0, 8);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const skillEvidence: string[] = [];
  for (const skill of jobSkills) {
    const found = termsForSkill(skill).filter((t) => hasTerm(cv, t));
    if (found.length) {
      matchedSkills.push(skill);
      skillEvidence.push(...found.slice(0, 2));
    } else missingSkills.push(skill);
  }
  const skillsScore = jobSkills.length ? (matchedSkills.length / jobSkills.length) * 100 : 50;

  // ── Domain / industry ──
  const familyText = `${job.title} ${job.department}`;
  const domainWords = [...new Set(DOMAIN_WORDS.filter((d) => d.match.test(familyText)).flatMap((d) => d.words))];
  const domainHits = domainWords.filter((w) => hasTerm(cv, w));
  const industryScore = domainWords.length ? Math.min(100, (domainHits.length / Math.min(8, domainWords.length)) * 100) : skillsScore;

  // ── Experience ──
  const years = estimateYears(cvText);
  const min = Math.max(0, job.experienceMin || 0);
  const max = Math.max(min, job.experienceMax || min);
  // Years only count as relevant when the CV shows work in this domain
  const relevance = domainHits.length >= 3 || matchedSkills.length >= 2 ? 1 : domainHits.length >= 2 || matchedSkills.length === 1 ? 0.4 : 0;
  const relevantYears = years * relevance;
  let expScore: number;
  if (min === 0) expScore = relevantYears > 0 ? 90 : 60;
  else if (relevantYears >= min) expScore = relevantYears > max + 4 ? 85 : 100;
  else expScore = (relevantYears / min) * 75;
  if (/\bintern(ship)?\b/.test(cv) && expScore < 20 && relevance >= 0.5) expScore = 20;

  // ── Education ──
  const degree = DEGREE_LEVELS.find((d) => d.pattern.test(cvText));
  const eduReqText = `${job.educationRequirements || ""} ${job.requirements.join(" ")}`;
  const fieldRule = FIELD_SYNONYMS.find((f) => f.match.test(eduReqText) && /degree|bachelor|graduate|master|mba/i.test(eduReqText));
  const fieldMatch = fieldRule ? fieldRule.words.some((w) => hasTerm(cv, w)) : true;
  const needsPostgrad = /\b(mba|pgdm|master|post\s?graduat)/i.test(job.educationRequirements || "") && !/preferred/i.test(job.educationRequirements || "");
  let eduScore = degree ? (degree.level >= 2 ? 70 : 40) : 15;
  if (degree && degree.level >= 2 && fieldMatch) eduScore += 30;
  if (degree?.level === 3 && !fieldMatch) eduScore += 10;
  if (needsPostgrad && (degree?.level ?? 0) < 3) eduScore -= 25;

  // ── Requirements ──
  const matchedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  for (const req of job.requirements) {
    const yearsAsked = req.match(/(\d+)\s*(?:-|–|to)?\s*\d*\s*\+?\s*years?/i);
    const tokens = significantTokens(req).filter((t) => !/^(bachelor'?s?|degree|graduate)$/.test(t));
    const expanded = tokens.map((t) => [...tokenForms(t), ...(Object.entries(SKILL_SYNONYMS).find(([k]) => k.includes(t))?.[1] ?? [])]);
    const hits = expanded.filter((alts) => alts.some((a) => hasTerm(cv, a))).length;
    let ok = tokens.length ? hits / tokens.length >= 0.5 : false;
    if (yearsAsked) ok = ok && relevantYears >= parseInt(yearsAsked[1], 10);
    if (/bachelor|degree|graduate/i.test(req)) {
      // A degree requirement may also ask for years ("… with 2-5 years in HR")
      ok = (degree?.level ?? 0) >= 2 && (fieldMatch || !fieldRule) && (!yearsAsked || relevantYears >= parseInt(yearsAsked[1], 10));
    }
    (ok ? matchedRequirements : missingRequirements).push(req.replace(/\.$/, ""));
  }
  const reqScore = job.requirements.length ? (matchedRequirements.length / job.requirements.length) * 100 : skillsScore;

  // ── Role fit: the job title / its key words in the CV, plus the requirements ──
  const titleTokens = significantTokens(job.title);
  const titleHit = hasTerm(cv, job.title) ? 1 : titleTokens.length ? titleTokens.filter((t) => hasTerm(cv, t)).length / titleTokens.length : 0;
  const roleFitScore = reqScore * 0.6 + titleHit * 100 * 0.4;

  // ── Location ──
  const cities = job.location
    .split(/[\/,|&]| or /i)
    .map((c) => c.trim())
    .filter(Boolean)
    .flatMap((c) => (/ncr|delhi/i.test(c) ? [c, "delhi", "new delhi", "noida", "gurugram", "gurgaon", "ghaziabad", "faridabad", "ncr"] : [c]));
  const inLocation = cities.some((c) => hasTerm(cv, c));
  const locScore = inLocation ? 100 : /relocat/.test(cv) ? 80 : /remote/i.test(job.location) ? 100 : 50;

  const evaluation = {
    relevantExperience: {
      score: clamp(expScore),
      evidence: [
        !years
          ? `No dated work experience found (${min}–${max} years needed)`
          : relevance < 1
            ? `${years} year${years === 1 ? "" : "s"} of work, little of it in ${job.department} (${min}–${max} needed)`
            : `About ${years} year${years === 1 ? "" : "s"} of relevant experience (${min}–${max} needed)`,
      ],
    },
    skills: { score: clamp(skillsScore), matched: matchedSkills, missing: missingSkills },
    education: {
      score: clamp(eduScore),
      evidence: [degree ? `${degree.label}${fieldRule ? (fieldMatch ? " in a related field" : " in a different field") : ""}` : "No degree found in the CV"],
    },
    industryExperience: {
      score: clamp(industryScore),
      evidence: [domainHits.length ? `Domain keywords: ${domainHits.slice(0, 4).join(", ")}` : `No ${job.department} keywords found`],
    },
    roleFit: {
      score: clamp(roleFitScore),
      evidence: [`${matchedRequirements.length} of ${job.requirements.length} job requirements met`],
    },
    location: {
      score: clamp(locScore),
      evidence: [inLocation ? `Based in / near ${job.location}` : /relocat/.test(cv) ? "Open to relocation" : `Location not in ${job.location}`],
    },
  };

  const strengths = [
    ...matchedSkills.map((s) => `${s} (${skillEvidence.find((e) => termsForSkill(s).includes(e)) ?? "found in CV"})`),
    ...(years >= min && relevance === 1 ? [`${years} years of relevant experience`] : []),
  ];
  const gaps = [
    ...missingSkills.map((s) => `Add or highlight ${s} in your CV`),
    ...(relevantYears < min ? [`Gain more hands-on experience (about ${min}+ years in ${job.department} is expected)`] : []),
    ...(degree && fieldRule && !fieldMatch ? ["A degree in a related field is preferred for this role"] : []),
    ...(!degree ? ["Mention your highest qualification clearly"] : []),
  ];

  const explanation =
    `${matchedSkills.length} of ${jobSkills.length} key skills found` +
    (matchedSkills.length ? ` (${matchedSkills.slice(0, 3).join(", ")})` : "") +
    `, about ${years} year${years === 1 ? "" : "s"} of experience against ${min}–${max} required` +
    `${degree ? `, ${degree.label.toLowerCase()}` : ", no degree found"}.`;

  return {
    candidate: {
      name: guessName(cvText),
      email: contact.email,
      phone: contact.phone,
      phones: contact.phones,
      linkedin: contact.linkedin,
      location: inLocation ? job.location : null,
      gender: null,
    },
    education: [],
    experience: [],
    skills: [...new Set(skillEvidence)],
    achievements: [],
    languages: [],
    currentCompany: null,
    currentDesignation: null,
    totalExperience: years ? `${years} Years` : null,
    noticePeriod: null,
    currentCTC: null,
    expectedCTC: null,
    evaluation,
    matchedRequirements,
    missingRequirements,
    strengths,
    gaps,
    explanation,
  };
}
