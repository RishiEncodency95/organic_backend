import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { IJob } from "../../models/careers/Job.model";

type MetricRow = [label: string, detail: string];
type RoleFamily = "sales" | "marketing" | "operations" | "engineering" | "general";

interface RoleProfile {
  reportingTo: string;
  roleObjective: (designation: string, project: string) => string;
  kras: MetricRow[];
  kpis: MetricRow[];
  screeningQuestions: string[];
  referenceIndustries: string[];
}

const COLORS = {
  ink: "172033",
  muted: "475569",
  accent: "166534",
  accentDark: "14532D",
  header: "233D4D",
  line: "CBD5E1",
  soft: "F1F5F9",
  alternate: "F8FAFC",
  white: "FFFFFF",
};

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
  bottom: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
  left: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
  right: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
  insideVertical: { style: BorderStyle.SINGLE, size: 5, color: COLORS.line },
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
};

const COMMON_SCREENING_QUESTIONS = [
  "Which industries or business domains have you worked in?",
  "What was your most important individual target or deliverable in your latest role?",
  "What measurable result did you achieve against that target?",
  "Which tools, platforms or systems do you use regularly for this work?",
  "Please describe one relevant project or assignment that you personally owned.",
  "What is your current and expected CTC?",
  "What is your notice period or earliest joining date?",
];

const ROLE_PROFILES: Record<RoleFamily, RoleProfile> = {
  sales: {
    reportingTo: "Business Head – Exhibitions",
    roleObjective: (designation, project) =>
      `The ${designation} will generate business for ${project} through exhibitor acquisition, exhibition stall/space sales, sponsorship sales and disciplined key-account development. The role owns the complete sales cycle from lead generation and client meetings to proposal, negotiation, booking and payment realization.`,
    kras: [
      ["Stall / Space Sales", "Achievement of assigned exhibition space sales target"],
      ["Individual Revenue", "Achievement of assigned monthly and exhibition-wise revenue target"],
      ["New Exhibitor Acquisition", "Continuous acquisition of relevant, high-quality exhibitors"],
      ["Sponsorship Sales", "Generation and closure of sponsorship revenue"],
      ["Key Account Development", "Development and closure of high-value accounts"],
      ["Repeat Business", "Retention and conversion of previous exhibitors and sponsors"],
      ["Sales Conversion", "Conversion of qualified opportunities into confirmed bookings"],
      ["Sales Pipeline", "Maintenance of adequate qualified pipeline against upcoming targets"],
      ["Payment Realization", "Timely collection of dues from assigned exhibitors and sponsors"],
      ["CRM & Reporting", "Complete and accurate activity, follow-up and pipeline reporting"],
    ],
    kpis: [
      ["Revenue Target Achievement", "% of assigned sales revenue achieved"],
      ["Exhibition Space Sold", "Square metres sold against assigned target"],
      ["New Exhibitors Closed", "Number and value of new exhibitors acquired"],
      ["Sponsorship Revenue", "Value of sponsorship business personally generated"],
      ["Repeat Exhibitors", "Number and value of previous exhibitors reconfirmed"],
      ["Qualified Leads", "Number of relevant sales opportunities generated"],
      ["Client Meetings", "Qualified client meetings and presentations conducted"],
      ["Proposal-to-Closure Ratio", "% of proposals converted into bookings"],
      ["Average Deal Value", "Average revenue generated per confirmed booking"],
      ["Payment Realization", "% of due amount collected from assigned accounts"],
      ["Pipeline Coverage", "Qualified pipeline value against upcoming revenue target"],
      ["CRM Compliance", "% of leads and follow-ups updated accurately and on time"],
    ],
    screeningQuestions: [
      "Which B2B exhibitions or trade shows have you previously sold?",
      "What was your individual sales or revenue target and what percentage did you achieve?",
      "How much exhibition space did you personally sell?",
      "What was the largest exhibitor deal you personally closed?",
      "Have you personally sold sponsorship packages? If yes, what was your largest closure?",
      "Which industries or sectors have you handled?",
      "Do you currently have an active exhibitor or client network?",
      "What is your current and expected CTC?",
      "What is your notice period or earliest joining date?",
    ],
    referenceIndustries: [
      "Exhibition Organisers",
      "Trade Shows",
      "Trade Fairs",
      "B2B Events",
      "Sponsorship Sales",
      "B2B Media",
      "Conference & Event Companies",
    ],
  },
  marketing: {
    reportingTo: "Head – Marketing & Communications",
    roleObjective: (designation, project) =>
      `The ${designation} will build awareness, engagement and qualified demand for ${project} through integrated digital marketing, content, media relations and performance-led campaigns. The role will plan, execute, measure and continuously improve campaigns across owned, earned and paid channels.`,
    kras: [
      ["Campaign Planning", "Timely development of integrated campaign plans and calendars"],
      ["Lead Generation", "Delivery of relevant, marketing-qualified enquiries"],
      ["Content & Social Media", "Consistent, high-quality publishing across priority channels"],
      ["Media & PR", "Relevant media coverage and strong stakeholder relationships"],
      ["Brand Governance", "Consistent application of approved brand and messaging standards"],
      ["Website & SEO", "Growth in relevant organic visibility and website engagement"],
      ["Performance Marketing", "Efficient management of paid campaigns and budgets"],
      ["Analytics & Reporting", "Accurate campaign reporting with actionable recommendations"],
    ],
    kpis: [
      ["Qualified Leads", "Number and quality of leads attributed to marketing"],
      ["Campaign ROI", "Revenue or pipeline influenced relative to campaign investment"],
      ["Cost per Lead", "Average media cost per qualified enquiry"],
      ["Website Growth", "Growth in relevant users, sessions and landing-page engagement"],
      ["Organic Visibility", "Improvement in priority keyword rankings and organic traffic"],
      ["Social Engagement", "Reach, engagement rate and audience growth"],
      ["Media Coverage", "Quality and relevance of earned media mentions"],
      ["Email Performance", "Open, click and conversion rates for email campaigns"],
      ["Delivery Timeliness", "% of campaigns delivered to agreed schedule"],
      ["Reporting Accuracy", "Completeness and accuracy of campaign dashboards"],
    ],
    screeningQuestions: [
      "Which digital campaigns have you personally planned and executed?",
      "What monthly media budget have you managed?",
      "Which campaign produced your strongest measurable result?",
      "Which analytics, advertising, CRM and publishing tools do you use?",
      "Please share an example of media coverage or PR outreach you secured.",
      "How do you measure lead quality and campaign ROI?",
      "What is your current and expected CTC?",
      "What is your notice period or earliest joining date?",
    ],
    referenceIndustries: [
      "Digital Marketing Agencies",
      "Public Relations",
      "B2B Events",
      "Media & Publishing",
      "FMCG",
      "Wellness & Lifestyle Brands",
    ],
  },
  operations: {
    reportingTo: "Business Head – Exhibitions",
    roleObjective: (designation, project) =>
      `The ${designation} will plan and deliver reliable end-to-end event operations for ${project}. The role will coordinate venues, vendors, logistics, exhibitors and internal teams to ensure every milestone is completed safely, on time, within budget and to the expected service standard.`,
    kras: [
      ["Event Planning", "Complete, practical operating plans for every event phase"],
      ["Venue & Vendor Coordination", "Timely confirmation and management of all partners"],
      ["Exhibitor Operations", "Smooth onboarding and operational support for exhibitors"],
      ["Logistics Management", "Accurate movement, installation and handover of materials"],
      ["Budget Control", "Delivery within approved operations budget"],
      ["Safety & Compliance", "Adherence to venue, statutory and safety requirements"],
      ["On-site Delivery", "Disciplined execution with fast resolution of issues"],
      ["Post-event Closure", "Timely reconciliation, feedback and closure reporting"],
    ],
    kpis: [
      ["Milestone Adherence", "% of operating milestones completed on schedule"],
      ["Budget Variance", "Actual operational spend against approved budget"],
      ["Vendor SLA Compliance", "% of vendors meeting quality and timing commitments"],
      ["Issue Resolution Time", "Average time taken to close operational issues"],
      ["Exhibitor Satisfaction", "Operational satisfaction score from exhibitors"],
      ["Safety Incidents", "Number and severity of reportable incidents"],
      ["Setup Readiness", "% readiness achieved before event opening"],
      ["Inventory Accuracy", "Accuracy of material and asset tracking"],
      ["Closure Timeliness", "Completion of reconciliation and closure reports"],
    ],
    screeningQuestions: [
      "Which exhibitions or large-scale events have you personally operated?",
      "What was the largest event, venue or exhibitor count you handled?",
      "Which operational budgets and vendor categories have you managed?",
      "Describe a serious on-site issue and how you resolved it.",
      "Which event planning, inventory or project-management tools do you use?",
      "How do you control safety, quality and schedule risk?",
      "What is your current and expected CTC?",
      "What is your notice period or earliest joining date?",
    ],
    referenceIndustries: [
      "Exhibition Organisers",
      "Trade Fairs",
      "Event Management Companies",
      "Venues & Convention Centres",
      "Logistics",
      "Experiential Marketing",
    ],
  },
  engineering: {
    reportingTo: "Technology Lead / Product Head",
    roleObjective: (designation, project) =>
      `The ${designation} will design, build and maintain reliable digital products and internal platforms for ${project}. The role owns high-quality implementation from technical planning and development through testing, release, monitoring and continuous improvement.`,
    kras: [
      ["Product Development", "Reliable delivery of agreed product features and improvements"],
      ["Code Quality", "Maintainable, reviewed and well-tested implementation"],
      ["Architecture", "Scalable technical design and sound engineering decisions"],
      ["API & Data Integration", "Secure and dependable integration across systems"],
      ["Performance", "Fast, stable and efficient user experiences"],
      ["Security", "Implementation aligned with application-security good practices"],
      ["Release Management", "Predictable deployments with minimal production disruption"],
      ["Documentation & Collaboration", "Clear documentation and effective cross-team delivery"],
    ],
    kpis: [
      ["Delivery Predictability", "% of committed work delivered within the agreed cycle"],
      ["Defect Rate", "Production defects relative to completed releases"],
      ["Test Coverage", "Automated coverage of critical application paths"],
      ["Application Performance", "Core response-time and user-experience measures"],
      ["System Reliability", "Availability and frequency of production incidents"],
      ["Resolution Time", "Mean time to diagnose and resolve defects"],
      ["Review Quality", "Code-review completion and rework rate"],
      ["Security Findings", "Number and closure time of relevant vulnerabilities"],
      ["Documentation", "Completeness of technical and release documentation"],
    ],
    screeningQuestions: [
      "Which production applications have you personally built or maintained?",
      "Describe your strongest project using the technologies required for this role.",
      "What parts of the architecture and codebase did you personally own?",
      "How do you approach testing, code review and release quality?",
      "Describe a difficult production issue and how you diagnosed it.",
      "Please share your portfolio, GitHub profile or relevant work samples, if available.",
      "What is your current and expected CTC?",
      "What is your notice period or earliest joining date?",
    ],
    referenceIndustries: [
      "SaaS & Product Companies",
      "Technology Services",
      "E-commerce",
      "Digital Platforms",
      "B2B Marketplaces",
      "Event Technology",
    ],
  },
  general: {
    reportingTo: "Department Head",
    roleObjective: (designation, project) =>
      `The ${designation} will own the key deliverables of the role and work with internal and external stakeholders to support the growth and smooth execution of ${project}. The position requires accountable planning, timely delivery, accurate reporting and continuous improvement.`,
    kras: [
      ["Role Deliverables", "Accurate and timely completion of assigned responsibilities"],
      ["Planning & Prioritisation", "Clear work plans aligned with business priorities"],
      ["Stakeholder Coordination", "Effective communication and dependable follow-through"],
      ["Quality & Compliance", "Work completed to the required standard and process"],
      ["Problem Solving", "Timely identification and resolution of delivery issues"],
      ["Reporting", "Complete, accurate and timely activity reporting"],
    ],
    kpis: [
      ["Target Achievement", "% of agreed targets and deliverables completed"],
      ["Delivery Timeliness", "% of work completed by the agreed deadline"],
      ["Quality Score", "Accuracy and quality of completed output"],
      ["Stakeholder Satisfaction", "Feedback from relevant internal and external stakeholders"],
      ["Issue Resolution", "Average time taken to resolve assigned issues"],
      ["Process Compliance", "Adherence to required systems and reporting processes"],
    ],
    screeningQuestions: COMMON_SCREENING_QUESTIONS,
    referenceIndustries: ["Relevant B2B Companies", "Events & Exhibitions", "Professional Services"],
  },
};

function compact(values: Array<string | undefined | null>): string[] {
  return values.map((value) => (value || "").trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripHtml(value?: string): string {
  return (value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function selectRoleFamily(job: IJob): RoleFamily {
  const haystack = compact([
    job.title,
    job.designation,
    job.department,
    ...(job.skills || []),
    ...(job.preferredSkills || []),
  ])
    .join(" ")
    .toLowerCase();

  if (/developer|software|engineer|react|next\.?js|node\.?js|frontend|backend|full[ -]?stack|technology|\bit\b/.test(haystack)) {
    return "engineering";
  }
  if (/marketing|public relations|\bpr\b|seo|social media|content|brand|communications/.test(haystack)) {
    return "marketing";
  }
  if (/operations|logistics|event delivery|venue|production/.test(haystack)) {
    return "operations";
  }
  if (/sales|sponsorship|business development|exhibitor|revenue|account manager/.test(haystack)) {
    return "sales";
  }
  return "general";
}

function formatExperience(job: IJob): string {
  if (job.experienceMin == null && job.experienceMax == null) return "—";
  const minimum = job.experienceMin ?? 0;
  const maximum = job.experienceMax ?? minimum;
  return minimum === maximum ? `${minimum} Years` : `${minimum}–${maximum} Years`;
}

function formatCtc(job: IJob): string {
  if (job.ctcMin == null && job.ctcMax == null) return job.salary || "As per company standards";
  const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
  if (job.ctcMin != null && job.ctcMax != null) {
    return job.ctcMin === job.ctcMax
      ? `${money(job.ctcMin)} per month`
      : `${money(job.ctcMin)}–${money(job.ctcMax)} per month`;
  }
  return `${money(job.ctcMin ?? job.ctcMax ?? 0)} per month`;
}

function bodyParagraph(text: string, options?: { bold?: boolean; after?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: options?.after ?? 110, line: 270 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        size: 20,
        color: COLORS.ink,
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 90 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.accent, space: 4 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: COLORS.accentDark,
      }),
    ],
  });
}

function bulletList(items: string[]): Paragraph[] {
  return unique(items).map(
    (item) =>
      new Paragraph({
        style: "JobBullet",
        text: stripHtml(item),
        bullet: { level: 0 },
        spacing: { after: 70, line: 260 },
      })
  );
}

function infoLine(label: string, value?: string): Paragraph {
  return new Paragraph({
    spacing: { after: 55, line: 250 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 19, color: COLORS.ink }),
      new TextRun({ text: value?.trim() || "—", size: 19, color: COLORS.ink }),
    ],
  });
}

function infoCell(lines: Paragraph[]): TableCell {
  return new TableCell({
    borders: NO_BORDERS,
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 110, bottom: 80, left: 130, right: 130 },
    verticalAlign: VerticalAlign.TOP,
    children: lines,
  });
}

function infoTable(job: IJob, profile: RoleProfile): Table {
  const salaryType = compact([
    job.salaryType,
    job.performanceIncentiveApplicable ? "Performance Incentive" : undefined,
  ]).join(" + ");

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      ...NO_BORDERS,
      top: { style: BorderStyle.SINGLE, size: 7, color: COLORS.line },
      bottom: { style: BorderStyle.SINGLE, size: 7, color: COLORS.line },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          infoCell([
            infoLine("Company", job.company),
            infoLine("Project", job.projectEvent || "Bharat Organic Expo"),
            infoLine("Department", job.department),
            infoLine("Designation", job.designation || job.title),
            infoLine("No. of Positions", String(job.totalOpenings ?? 1)),
            infoLine("Location", job.location),
          ]),
          infoCell([
            infoLine("Reporting To", profile.reportingTo),
            infoLine("Experience", formatExperience(job)),
            infoLine("Education", job.educationRequirements),
            infoLine("CTC", formatCtc(job)),
            infoLine("Salary Type", salaryType || "CTC"),
            infoLine("Employment Type", job.employmentType),
          ]),
        ],
      }),
    ],
  });
}

function metricCell(text: string, width: number, options?: { header?: boolean; bold?: boolean; shaded?: boolean }): TableCell {
  const header = Boolean(options?.header);
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 85, bottom: 85, left: 110, right: 110 },
    shading: {
      type: ShadingType.CLEAR,
      color: "auto",
      fill: header ? COLORS.header : options?.shaded ? COLORS.alternate : COLORS.white,
    },
    children: [
      new Paragraph({
        keepNext: header,
        spacing: { after: 0, line: 245 },
        children: [
          new TextRun({
            text,
            bold: header || options?.bold,
            size: 18,
            color: header ? COLORS.white : COLORS.ink,
          }),
        ],
      }),
    ],
  });
}

function metricTable(leftHeading: string, rightHeading: string, rows: MetricRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        height: { value: 390, rule: HeightRule.ATLEAST },
        children: [
          metricCell(leftHeading, 40, { header: true }),
          metricCell(rightHeading, 60, { header: true }),
        ],
      }),
      ...rows.map(
        ([label, detail], index) =>
          new TableRow({
            cantSplit: true,
            children: [
              metricCell(label, 40, { bold: true, shaded: index % 2 === 1 }),
              metricCell(detail, 60, { shaded: index % 2 === 1 }),
            ],
          })
      ),
    ],
  });
}

function numberedQuestions(items: string[]): Paragraph[] {
  return unique(items).map(
    (item) =>
      new Paragraph({
        numbering: { reference: "screening-questions", level: 0 },
        spacing: { after: 75, line: 260 },
        children: [new TextRun({ text: item, size: 20, color: COLORS.ink })],
      })
  );
}

function projectOverview(job: IJob): { heading: string; paragraphs: string[]; coverage: string[] } {
  const project = job.projectEvent || "Bharat Organic Expo";
  const suppliedAbout = stripHtml(job.aboutCompany);
  if (suppliedAbout) {
    return {
      heading: `About ${project}`,
      paragraphs: suppliedAbout.split(/\n+/).filter(Boolean),
      coverage: [],
    };
  }

  if (/bharat organic expo/i.test(project)) {
    return {
      heading: "About Bharat Organic Expo",
      paragraphs: [
        "Bharat Organic Expo is a B2B exhibition platform connecting manufacturers, brands, suppliers, buyers, government bodies, industry associations and professionals across the organic and allied industries.",
        "The exhibition covers:",
      ],
      coverage:
        job.targetIndustrySegments && job.targetIndustrySegments.length > 0
          ? job.targetIndustrySegments
          : [
              "Organic Food & Nutrition",
              "AYUSH, Herbal & Wellness",
              "Organic Agriculture",
              "Natural Living & Personal Care",
              "GreenTech & Sustainability",
              "Trade, Certification & Global Business",
            ],
    };
  }

  return {
    heading: `About ${project}`,
    paragraphs: [
      `${project} is an initiative of ${job.company || "the organisation"}. This role will contribute directly to the project's planned growth, quality of delivery and stakeholder experience.`,
    ],
    coverage: [],
  };
}

function educationAndExperience(job: IJob): string[] {
  return unique(
    compact([
      job.educationRequirements,
      `${formatExperience(job)} of relevant professional experience.`,
      job.specificExperience,
      ...(job.requirements || []),
      ...(job.preferredQualifications || []),
    ])
  );
}

export async function generateJobDescriptionDocx(job: IJob): Promise<Buffer> {
  const designation = (job.designation || job.title).trim();
  const project = (job.projectEvent || "Bharat Organic Expo").trim();
  const profile = ROLE_PROFILES[selectRoleFamily(job)];
  const overview = projectOverview(job);
  const suppliedObjective = stripHtml(job.roleObjective || job.description);
  const objective = suppliedObjective || profile.roleObjective(designation, project);
  const skills = unique([...(job.skills || []), ...(job.preferredSkills || [])]);
  const industries = unique(job.targetIndustrySegments || []);
  const referenceIndustries = unique([...profile.referenceIndustries, ...industries]);
  const compensation = formatCtc(job);
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 150 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 14, color: COLORS.accent, space: 7 },
      },
      children: [
        new TextRun({
          text: designation,
          bold: true,
          size: 34,
          color: COLORS.accentDark,
        }),
      ],
    }),
    infoTable(job, profile),
    sectionHeading(overview.heading),
    ...overview.paragraphs.map((paragraph) => bodyParagraph(paragraph)),
    ...bulletList(overview.coverage),
    sectionHeading("Role Objective"),
    ...objective.split(/\n+/).filter(Boolean).map((paragraph) => bodyParagraph(paragraph)),
    sectionHeading("Key Responsibilities"),
    ...bulletList(job.responsibilities || []),
    sectionHeading("Key Result Areas (KRA)"),
    metricTable("KRA", "Expected Result", profile.kras),
    sectionHeading("Key Performance Indicators (KPI)"),
    metricTable("KPI", "Measurement", profile.kpis)
  );

  if (industries.length > 0) {
    children.push(
      sectionHeading("Target Industry Segments"),
      bodyParagraph("The candidate will primarily work across the following industry segments:"),
      bodyParagraph(industries.join("  •  "), { bold: true })
    );
  }

  children.push(
    sectionHeading("Education & Experience"),
    ...bulletList(educationAndExperience(job)),
    sectionHeading("Preferred Reference Industry"),
    bodyParagraph(referenceIndustries.join("  •  "), { bold: true })
  );

  if (skills.length > 0) {
    children.push(sectionHeading("Key Skills"), bodyParagraph(skills.join("  |  "), { bold: true }));
  }

  children.push(
    sectionHeading("Compensation"),
    bodyParagraph(
      `CTC: ${compensation}${job.performanceIncentiveApplicable ? " + Performance Incentive" : ""}`,
      { bold: true }
    )
  );

  if (job.performanceIncentiveApplicable) {
    children.push(
      bodyParagraph(
        `Performance incentive will be linked to actual achievement and the applicable company incentive policy${job.incentiveType ? ` (${job.incentiveType})` : ""}.`
      )
    );
  }

  children.push(
    sectionHeading("Mandatory Candidate Screening Questions"),
    ...numberedQuestions(profile.screeningQuestions),
    new Paragraph({
      spacing: { before: 150, after: 0 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.soft },
      indent: { left: 120, right: 120 },
      children: [
        new TextRun({
          text: `Preference will be given to candidates with directly relevant experience and a verifiable track record for the ${designation} role.`,
          bold: true,
          size: 20,
          color: COLORS.accentDark,
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 20, color: COLORS.ink },
          paragraph: { spacing: { after: 110, line: 260 } },
        },
      },
      paragraphStyles: [
        {
          id: "JobBullet",
          name: "Job Bullet",
          basedOn: "Normal",
          quickFormat: true,
          run: { font: "Arial", size: 20, color: COLORS.ink },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "screening-questions",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 430, hanging: 230 } },
                run: { font: "Arial", size: 20, bold: true, color: COLORS.ink },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
