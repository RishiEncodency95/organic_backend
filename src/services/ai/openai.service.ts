import OpenAI from "openai";

export interface AIAnalysisOutput {
  candidate: {
    name: string | null;
    email: string | null;
    phone: string | null;
    /** Additional numbers found in the CV, when it lists more than one. */
    phones?: string[];
    location: string | null;
    linkedin: string | null;
  };
  education: string[];
  experience: string[];
  skills: string[];
  achievements: string[];
  languages: string[];
  currentCompany: string | null;
  currentDesignation: string | null;
  totalExperience: string | null;
  noticePeriod: string | null;
  expectedCTC: string | null;

  // Matching evaluation against Job Description
  evaluation: {
    relevantExperience: { score: number; evidence: string[] };
    skills: { score: number; matched: string[]; missing: string[] };
    education: { score: number; evidence: string[] };
    industryExperience: { score: number; evidence: string[] };
    roleFit: { score: number; evidence: string[] };
    location: { score: number; evidence: string[] };
  };

  matchedRequirements: string[];
  missingRequirements: string[];
  strengths: string[];
  gaps: string[];
  explanation: string;
}

export const analyzeCvWithOpenAI = async (
  cvText: string,
  jobDescription: {
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
): Promise<AIAnalysisOutput> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `You are an expert HR recruiter & CV analyzer for Bharat Organic Expo 2027.
Analyze the following candidate CV text and compare it with the Job Description provided below.

CRITICAL INSTRUCTIONS:
1. NEVER invent or hallucinate information. If email, phone, location, currentCompany, currentDesignation, totalExperience, noticePeriod, or expectedCTC are NOT explicitly stated in the CV, return null.
2. Return ONLY a strictly valid JSON object adhering EXACTLY to the structure below.
3. For skills, include ONLY skills explicitly found in the CV text.
4. For scoring each dimension (relevantExperience, skills, education, industryExperience, roleFit, location), provide a numeric score between 0 and 100 based strictly on factual evidence in the CV compared to the Job Description.

JOB DESCRIPTION:
- Title: ${jobDescription.title}
- Department: ${jobDescription.department}
- Location: ${jobDescription.location}
- Experience Range: ${jobDescription.experienceMin} - ${jobDescription.experienceMax} years
- Education Required: ${jobDescription.educationRequirements || "Relevant degree"}
- Required Skills: ${jobDescription.skills.join(", ")}
- Key Responsibilities: ${jobDescription.responsibilities.join("; ")}
- Key Requirements: ${jobDescription.requirements.join("; ")}

CANDIDATE CV TEXT:
"""
${cvText}
"""

REQUIRED JSON RESPONSE STRUCTURE:
{
  "candidate": {
    "name": "Full Name with a space between First and Last Name (e.g. 'Rohit Kumar'), in Title Case even if the CV writes it in capitals, or null",
    "email": "Email Address or null",
    "phone": "Primary phone number exactly as written in the CV, or null",
    "phones": ["EVERY phone number written anywhere in the CV, in the order they appear — include alternate/secondary numbers; empty array if none"],
    "location": "Current City/Location or null",
    "linkedin": "LinkedIn profile URL or handle exactly as written in the CV (e.g. 'linkedin.com/in/rohit-kumar') or null"
  },
  "education": ["Degree/Institution listed in CV"],
  "experience": ["Work history/role listed in CV"],
  "skills": ["Explicitly listed skills"],
  "achievements": ["Key achievements"],
  "languages": ["Languages known"],
  "currentCompany": "Company name or null",
  "currentDesignation": "Current job title or null",
  "totalExperience": "Years/months of total experience e.g. '5 Years' or null",
  "noticePeriod": "Notice period e.g. '30 Days' or null",
  "expectedCTC": "Expected salary/CTC or null",
  "evaluation": {
    "relevantExperience": { "score": 85, "evidence": ["8 years in B2B exhibition sales"] },
    "skills": { "score": 80, "matched": ["Client Acquisition", "Negotiation"], "missing": ["Sponsorship Sales"] },
    "education": { "score": 90, "evidence": ["MBA in Marketing"] },
    "industryExperience": { "score": 75, "evidence": ["5 years in Wellness & Events"] },
    "roleFit": { "score": 80, "evidence": ["Strong track record in lead generation"] },
    "location": { "score": 100, "evidence": ["Based in Delhi NCR"] }
  },
  "matchedRequirements": ["Relevant experience in exhibition sales", "Good communication"],
  "missingRequirements": ["Sponsorship sales background"],
  "strengths": ["Extensive B2B sales history", "Delhi NCR location"],
  "gaps": ["Lacks direct organic industry exposure"],
  "explanation": "Summary paragraph explaining how the candidate aligns with this job."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a precise, unbiased JSON-only HR AI assistant." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content) as AIAnalysisOutput;
  return parsed;
};
