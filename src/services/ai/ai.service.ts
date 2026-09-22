import { analyzeCvWithOpenAI, AIAnalysisOutput } from "./openai.service";
import { analyzeCvWithGemini } from "./gemini.service";

export interface UnifiedAnalysisResult {
  provider: "OpenAI" | "Gemini";
  extractedProfile: {
    candidate: {
      name: string | null;
      email: string | null;
      phone: string | null;
      location: string | null;
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
  };
  overallScore: number;
  eligibilityThreshold: number;
  eligible: boolean;
  breakdown: {
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

/**
 * Deterministic formula to calculate score strictly in code.
 * AI provides dimension scores (0-100), backend computes final matchScore.
 */
export const calculateDeterministicScore = (evalObj: {
  relevantExperience: { score: number };
  skills: { score: number };
  education: { score: number };
  industryExperience: { score: number };
  roleFit: { score: number };
  location: { score: number };
}): number => {
  const exp = Math.min(100, Math.max(0, evalObj.relevantExperience?.score || 0));
  const skills = Math.min(100, Math.max(0, evalObj.skills?.score || 0));
  const edu = Math.min(100, Math.max(0, evalObj.education?.score || 0));
  const industry = Math.min(100, Math.max(0, evalObj.industryExperience?.score || 0));
  const roleFit = Math.min(100, Math.max(0, evalObj.roleFit?.score || 0));
  const location = Math.min(100, Math.max(0, evalObj.location?.score || 0));

  const weightedScore =
    exp * 0.25 +
    skills * 0.20 +
    edu * 0.15 +
    industry * 0.15 +
    roleFit * 0.15 +
    location * 0.10;

  return Math.round(weightedScore);
};

export const runCvAnalysisPipeline = async (
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
    eligibilityThreshold?: number;
  }
): Promise<UnifiedAnalysisResult> => {
  let aiOutput: AIAnalysisOutput | null = null;
  let provider: "OpenAI" | "Gemini" = "OpenAI";

  // Regex extraction for contact info as secondary guarantee
  let regexEmail: string | null = null;
  let regexPhone: string | null = null;

  const emailMatch = cvText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  if (emailMatch) regexEmail = emailMatch[0];

  const phoneMatch = cvText.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, "").length >= 10) {
    regexPhone = phoneMatch[0].trim();
  }

  // 1. Try Primary Provider: OpenAI
  try {
    console.log("🤖 Running OpenAI CV analysis...");
    aiOutput = await analyzeCvWithOpenAI(cvText, jobDescription);
  } catch (openAiError) {
    console.warn("⚠️ OpenAI analysis failed or unavailable:", (openAiError as Error).message);
    console.log("🔄 Fallback to Gemini CV analysis...");
    
    // 2. Fallback Provider: Gemini
    try {
      aiOutput = await analyzeCvWithGemini(cvText, jobDescription);
      provider = "Gemini";
    } catch (geminiError) {
      console.warn("⚠️ Gemini fallback also failed, running local deterministic analyzer...");
      
      // Heuristic analysis score based on keyword match
      const lowerCv = cvText.toLowerCase();
      let matchedCount = 0;
      const matchedReqs: string[] = [];
      const missingReqs: string[] = [];

      for (const req of jobDescription.requirements) {
        const keywords = req.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const hasMatch = keywords.some(k => lowerCv.includes(k));
        if (hasMatch) {
          matchedCount++;
          matchedReqs.push(req);
        } else {
          missingReqs.push(req);
        }
      }

      const ratio = jobDescription.requirements.length > 0 ? matchedCount / jobDescription.requirements.length : 0.7;
      const heuristicScore = Math.round(ratio * 100);

      aiOutput = {
        candidate: {
          name: null,
          email: regexEmail,
          phone: regexPhone,
          location: lowerCv.includes("delhi") || lowerCv.includes("noida") || lowerCv.includes("gurugram") ? "Delhi NCR" : null,
        },
        education: [],
        experience: [],
        skills: jobDescription.skills.filter(s => lowerCv.includes(s.toLowerCase())),
        achievements: [],
        languages: [],
        currentCompany: null,
        currentDesignation: null,
        totalExperience: null,
        noticePeriod: null,
        expectedCTC: null,
        evaluation: {
          relevantExperience: { score: heuristicScore, evidence: matchedReqs },
          skills: { score: Math.round(heuristicScore * 0.9), matched: jobDescription.skills.filter(s => lowerCv.includes(s.toLowerCase())), missing: [] },
          education: { score: lowerCv.includes("mba") || lowerCv.includes("graduate") || lowerCv.includes("bachelor") ? 90 : 60, evidence: [] },
          industryExperience: { score: lowerCv.includes("sales") || lowerCv.includes("exhibition") || lowerCv.includes("event") ? 80 : 40, evidence: [] },
          roleFit: { score: heuristicScore, evidence: [] },
          location: { score: lowerCv.includes("delhi") || lowerCv.includes("noida") || lowerCv.includes("gurugram") ? 100 : 70, evidence: [] },
        },
        matchedRequirements: matchedReqs,
        missingRequirements: missingReqs,
        strengths: matchedReqs,
        gaps: missingReqs,
        explanation: "Candidate evaluated based on skills and requirement keywords from CV.",
      };
    }
  }

  if (!aiOutput || !aiOutput.evaluation) {
    throw new Error("Invalid AI output format.");
  }

  // Merge regex email/phone if AI returned null
  if (!aiOutput.candidate.email && regexEmail) aiOutput.candidate.email = regexEmail;
  if (!aiOutput.candidate.phone && regexPhone) aiOutput.candidate.phone = regexPhone;

  // 3. Compute Deterministic Match Score
  const overallScore = calculateDeterministicScore(aiOutput.evaluation);
  const threshold = jobDescription.eligibilityThreshold ?? 40;
  const eligible = overallScore >= threshold;

  return {
    provider,
    extractedProfile: {
      candidate: aiOutput.candidate || { name: null, email: null, phone: null, location: null },
      education: aiOutput.education || [],
      experience: aiOutput.experience || [],
      skills: aiOutput.skills || [],
      achievements: aiOutput.achievements || [],
      languages: aiOutput.languages || [],
      currentCompany: aiOutput.currentCompany || null,
      currentDesignation: aiOutput.currentDesignation || null,
      totalExperience: aiOutput.totalExperience || null,
      noticePeriod: aiOutput.noticePeriod || null,
      expectedCTC: aiOutput.expectedCTC || null,
    },
    overallScore,
    eligibilityThreshold: threshold,
    eligible,
    breakdown: {
      relevantExperience: {
        score: aiOutput.evaluation.relevantExperience?.score || 0,
        evidence: aiOutput.evaluation.relevantExperience?.evidence || [],
      },
      skills: {
        score: aiOutput.evaluation.skills?.score || 0,
        matched: aiOutput.evaluation.skills?.matched || [],
        missing: aiOutput.evaluation.skills?.missing || [],
      },
      education: {
        score: aiOutput.evaluation.education?.score || 0,
        evidence: aiOutput.evaluation.education?.evidence || [],
      },
      industryExperience: {
        score: aiOutput.evaluation.industryExperience?.score || 0,
        evidence: aiOutput.evaluation.industryExperience?.evidence || [],
      },
      roleFit: {
        score: aiOutput.evaluation.roleFit?.score || 0,
        evidence: aiOutput.evaluation.roleFit?.evidence || [],
      },
      location: {
        score: aiOutput.evaluation.location?.score || 0,
        evidence: aiOutput.evaluation.location?.evidence || [],
      },
    },
    matchedRequirements: aiOutput.matchedRequirements || [],
    missingRequirements: aiOutput.missingRequirements || [],
    strengths: aiOutput.strengths || [],
    gaps: aiOutput.gaps || [],
    explanation: aiOutput.explanation || "CV analyzed successfully against job parameters.",
  };
};
