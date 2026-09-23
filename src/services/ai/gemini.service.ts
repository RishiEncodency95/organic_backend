import { AIAnalysisOutput } from "./openai.service";

export const analyzeCvWithGemini = async (
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = `You are an expert HR recruiter & CV analyzer for Bharat Organic Expo 2027.
Analyze the following candidate CV text and compare it with the Job Description provided below.

CRITICAL INSTRUCTIONS:
1. NEVER invent or hallucinate information. If email, phone, location, currentCompany, currentDesignation, totalExperience, noticePeriod, currentCTC, or expectedCTC are NOT explicitly stated in the CV, return null.
2. Return ONLY raw JSON without markdown formatting or code blocks.
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
    "name": "Full Name with space between First and Last Name (e.g. 'Rishi Sharma') or null",
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
  "currentCTC": "Current salary/CTC exactly as stated in the CV, or null if not mentioned",
  "expectedCTC": "Expected salary/CTC or null",
  "evaluation": {
    "relevantExperience": { "score": 85, "evidence": ["8 years in B2B exhibition sales"] },
    "skills": { "score": 80, "matched": ["Client Acquisition", "Negotiation"], "missing": ["Sponsorship Sales"] },
    "education": { "score": 90, "evidence": ["MBA in Marketing"] },
    "industryExperience": { "score": 75, "evidence": ["5 years in Wellness & Events"] },
    "roleFit": { "score": 80, "evidence": ["Strong track record in lead generation"] },
    "location": { "score": 100, "evidence": ["Based in Delhi NCR"] }
  },
  "matchedRequirements": ["Relevant experience in exhibition sales"],
  "missingRequirements": ["Sponsorship sales background"],
  "strengths": ["Extensive B2B sales history"],
  "gaps": ["Lacks direct organic industry exposure"],
  "explanation": "Summary paragraph explaining how the candidate aligns with this job."
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errText}`);
  }

  const resData = (await response.json()) as any;
  const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error("Empty response from Gemini API");
  }

  const cleanedJson = textOutput.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleanedJson) as AIAnalysisOutput;
  return parsed;
};
