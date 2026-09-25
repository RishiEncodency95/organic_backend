import OpenAI from "openai";

export interface JobBasicInfo {
  title: string;
  designation?: string;
  company?: string;
  projectEvent?: string;
  department: string;
  jobCode?: string;
  employmentType: string;
  workplaceType: string;
  totalOpenings?: number;
  location: string;
  experienceMin?: number;
  experienceMax?: number;
  educationRequirements?: string;
  ctcMin?: number;
  ctcMax?: number;
  salaryType?: string;
  performanceIncentiveApplicable?: boolean;
  incentiveType?: string;
  keyResponsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  targetIndustrySegments?: string[];
  specificExperience?: string;
}

export interface GeneratedJobContent {
  opportunity: string;
  keyResponsibilities: string[];
  whoCanApply: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  targetIndustrySegments: string[];
  specificExperience: string;
  reportingTo: string;
  kras: { label: string; result: string }[];
  kpis: { label: string; measurement: string }[];
  referenceIndustries: string[];
  screeningQuestions: string[];
}

/** Trims a sentence down to a word budget without cutting a word in half. */
const capWords = (text: string, maxWords: number): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "") + "…";
};

/** Joins bullets and, if the combined plain text would exceed the editor's char cap,
 * drops bullets from the end (never mid-sentence) until it fits. */
const capBulletsToChars = (bullets: string[], maxChars: number): string[] => {
  const cleaned = bullets.map((b) => b.trim()).filter(Boolean);
  const kept: string[] = [];
  let total = 0;
  for (const bullet of cleaned) {
    const next = total + bullet.length;
    if (next > maxChars && kept.length > 0) break;
    kept.push(bullet.length > maxChars ? `${bullet.slice(0, maxChars - 1)}…` : bullet);
    total = next;
    if (total >= maxChars) break;
  }
  return kept.length > 0 ? kept : cleaned.slice(0, 1);
};

export const generateJobDescriptionWithAI = async (info: JobBasicInfo): Promise<GeneratedJobContent> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 });

  const ctcLine =
    info.ctcMin != null || info.ctcMax != null
      ? `${info.ctcMin ?? "?"} - ${info.ctcMax ?? "?"} (${info.salaryType || "CTC"})${
          info.performanceIncentiveApplicable ? `, plus ${info.incentiveType || "performance"} incentive` : ""
        }`
      : "Not specified";

  const prompt = `You are an expert HR recruiter writing a job posting for Bharat Organic Expo 2027 (an organic industry trade expo & conference company in India).

Using ONLY the job details below, write the job posting content. Do not invent facts (like a specific product or client) not implied by the details given — write in a professional, factual, recruiting tone.

JOB DETAILS:
- Job Title: ${info.title}
- Designation: ${info.designation || "Not specified"}
- Company: ${info.company || "Bharat Organic Expo"}
- Project / Event: ${info.projectEvent || "Not specified"}
- Department: ${info.department}
- Job Code / Reference ID: ${info.jobCode || "Not specified"}
- Employment Type: ${info.employmentType}
- Workplace Type: ${info.workplaceType}
- Total Openings: ${info.totalOpenings ?? 1}
- Location: ${info.location}
- Experience Required: ${info.experienceMin ?? 0} - ${info.experienceMax ?? 0} years
- Education: ${info.educationRequirements || "Graduate"}
- Compensation: ${ctcLine}
- Existing Key Responsibilities: ${info.keyResponsibilities?.filter(Boolean).join(" | ") || "Not specified"}
- Required Skills: ${info.requiredSkills?.filter(Boolean).join(", ") || "Not specified"}
- Preferred Skills: ${info.preferredSkills?.filter(Boolean).join(", ") || "Not specified"}
- Target Industry Segments: ${info.targetIndustrySegments?.filter(Boolean).join(", ") || "Not specified"}
- Specific Experience: ${info.specificExperience || "Not specified"}

ROLE-ALIGNMENT RULES (highest priority):
- Job Title, Designation and Department define the job function. Project/Event and industry fields only provide business context.
- Never turn a support/function role into an event-operations role merely because the company runs an expo or event.
- For HR / Human Resources / People roles, KRAs and KPIs must cover role-relevant areas such as talent acquisition, employee relations, performance management, retention, HR compliance, workforce records or learning and development as appropriate to the seniority. Do not use venue, vendor, logistics, exhibitor, setup or event-delivery metrics unless the title/designation/department explicitly makes those duties part of the role.
- Every KRA and KPI must be traceable to this exact role's function and seniority. Avoid generic event, sales or marketing measures when they are not supported by the Job Title, Designation or Department.
- Compensation, experience, workplace and employment details should influence seniority and scope, but must not change the core job function.

STRICT OUTPUT RULES (violating these breaks the form — follow exactly):
IMPORTANT: For every limit below, use as much of the given budget as you can — get close to the
maximum, don't stop early. A short, thin answer that is well under the limit is WRONG output,
just as much as going over is. Add genuinely useful detail (specific duties, specific candidate
traits) until you are near the ceiling, never invented facts, then stop.
1. "opportunity": ONE sentence, TARGET 22-25 words (hard maximum 25 words, never less than 20). A compelling, detailed one-line summary of the role.
2. "keyResponsibilities": 4-5 bullet points, detailed enough that their combined length (just the text, no bullet symbols) lands between 260-295 characters total — never under 250, never over 300.
3. "whoCanApply": 3-4 bullet points describing the ideal candidate profile in enough detail that their combined length lands between 170-195 characters total — never under 150, never over 200.
4. "requiredSkills": 5-6 short skill tags (2-4 words each, e.g. "B2B Sales", "CRM Tools").
5. "preferredSkills": 3-4 short skill tags, nice-to-have, distinct from requiredSkills.
6. "targetIndustrySegments": 3-4 short industry/sector tags relevant to this role (e.g. "Organic Food & Beverages", "Events & Exhibitions").
7. "specificExperience": ONE detailed phrase, targeting 250-295 characters (never over 300), e.g. "Direct exhibition / trade show sales experience preferred, ideally within the organic, wellness or events industry, with a proven record of closing large-scale B2B partnerships."
8. "reportingTo": ONE realistic job title this role would report to (e.g. a "Business Head" reports to a "CEO" or "Director", a specialist reports to a department Head/Manager) — must be more senior than this role, specific to THIS role's function, not generic.
9. "kras": 5-6 Key Result Areas SPECIFIC to this exact role's function (e.g. for an exhibitions/business-development role: things like "Exhibitor Acquisition", "Revenue Growth", "Partnership Development" — NOT generic marketing/campaign KRAs unless this genuinely is a marketing role). Each item: {"label": "short KRA name (2-4 words)", "result": "one-line expected result, under 90 characters"}.
10. "kpis": 5-8 Key Performance Indicators that measure the KRAs above, specific to this role's function. Each item: {"label": "short KPI name (2-4 words)", "measurement": "how it's measured, under 90 characters"}.
11. "referenceIndustries": 3-6 industries a strong candidate for this role would likely come from (e.g. "B2B Events", "Exhibitions & Trade Shows", "FMCG Sales" — tailored to this role's function).
12. "screeningQuestions": 6-8 short mandatory screening questions an HR screener would ask a candidate for THIS specific role (not generic) — end with "What is your current and expected CTC?" and "What is your notice period or earliest joining date?" as the last two.

Return ONLY a strictly valid JSON object with EXACTLY these keys: opportunity (string), keyResponsibilities (string array), whoCanApply (string array), requiredSkills (string array), preferredSkills (string array), targetIndustrySegments (string array), specificExperience (string), reportingTo (string), kras (array of {label, result}), kpis (array of {label, measurement}), referenceIndustries (string array), screeningQuestions (string array).`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a precise, JSON-only HR job-posting writer. You always strictly respect word/character limits given to you." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content) as Partial<GeneratedJobContent>;

  const kras = Array.isArray(parsed.kras)
    ? parsed.kras
        .filter((k): k is { label: string; result: string } => !!k && typeof k.label === "string" && typeof k.result === "string")
        .slice(0, 6)
        .map((k) => ({ label: k.label.trim(), result: k.result.trim().slice(0, 120) }))
    : [];

  const kpis = Array.isArray(parsed.kpis)
    ? parsed.kpis
        .filter((k): k is { label: string; measurement: string } => !!k && typeof k.label === "string" && typeof k.measurement === "string")
        .slice(0, 8)
        .map((k) => ({ label: k.label.trim(), measurement: k.measurement.trim().slice(0, 120) }))
    : [];

  if (kras.length < 5 || kpis.length < 5) {
    throw new Error("OpenAI returned incomplete role-specific KRA/KPI content");
  }

  const roleIdentity = `${info.title} ${info.designation || ""} ${info.department}`.toLowerCase();
  const isHrRole = /human resources|\bhr\b|talent acquisition|employee relations|people operations|people ops|recruitment|recruiter/.test(roleIdentity);
  if (isHrRole) {
    const hrareaPattern = /talent|recruit|hiring|employee|performance|retention|people|workforce|compliance|training|learning|hr\b|grievance|engagement|payroll/;
    const eventOpsPattern = /venue|vendor|logistics|exhibitor|event setup|on-site delivery|material movement/;
    const alignedKras = kras.filter((item) => hrareaPattern.test(`${item.label} ${item.result}`.toLowerCase())).length;
    const unrelatedEventKras = kras.filter((item) => eventOpsPattern.test(`${item.label} ${item.result}`.toLowerCase())).length;
    if (alignedKras < 3 || unrelatedEventKras > 1) {
      throw new Error("OpenAI returned KRA content that does not match the HR role");
    }
  }

  return {
    opportunity: capWords(parsed.opportunity || "", 25),
    keyResponsibilities: capBulletsToChars(Array.isArray(parsed.keyResponsibilities) ? parsed.keyResponsibilities : [], 295),
    whoCanApply: capBulletsToChars(Array.isArray(parsed.whoCanApply) ? parsed.whoCanApply : [], 195),
    requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.filter(Boolean).slice(0, 8) : [],
    preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.filter(Boolean).slice(0, 6) : [],
    targetIndustrySegments: Array.isArray(parsed.targetIndustrySegments) ? parsed.targetIndustrySegments.filter(Boolean).slice(0, 6) : [],
    specificExperience: (parsed.specificExperience || "").trim().slice(0, 300),
    reportingTo: (parsed.reportingTo || "").trim().slice(0, 80),
    kras,
    kpis,
    referenceIndustries: Array.isArray(parsed.referenceIndustries) ? parsed.referenceIndustries.filter(Boolean).slice(0, 6) : [],
    screeningQuestions: Array.isArray(parsed.screeningQuestions) ? parsed.screeningQuestions.filter(Boolean).slice(0, 8) : [],
  };
};
