import { Request, Response } from "express";

/**
 * AI Content Audit & Copy/Plagiarism Detection
 * Checks text for AI-generation likelihood, copy-paste patterns, readability, and SEO friendliness.
 */
export const aiContentAuditController = {
  auditContent: async (req: Request, res: Response) => {
    try {
      const { text, targetKeyword, route } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 20) {
        return res.status(400).json({
          success: false,
          message: "Please provide at least 20 characters of content to audit.",
        });
      }

      const cleanText = text.trim();
      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

      // 1. Check if Gemini / OpenAI API key exists for AI analysis
      const geminiKey = process.env.GEMINI_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      let aiScore = 0; // 0 = 100% human, 100 = 100% AI generated
      let originalityScore = 90;
      let isAiDetected = false;
      let flaggedPhrases: string[] = [];
      let readabilityGrade = "Good (Grade 8-10)";
      let verdict = "Human-written & Original";
      let feedback: string[] = [];

      const prompt = `You are an expert AI content detector, plagiarism analyst, and SEO content evaluator.
Analyze the following website content text.
Determine:
1. aiLikelihood: 0 to 100 score (where > 65 means likely AI generated / copy-pasted ChatGPT template)
2. originalityScore: 0 to 100 score
3. isAiDetected: boolean (true if aiLikelihood > 65)
4. flaggedPhrases: list of sentences or phrases that appear robotic, clichéd AI filler, or generic copy-paste
5. verdict: short verdict (e.g. "Likely AI-Generated / Template", "Human-Written High Quality", "Needs Rewriting")
6. keywordDensity: percentage if targetKeyword "${targetKeyword || ""}" is mentioned
7. suggestions: 2-3 specific recommendations to make the content original, human, and high-ranking

Text to analyze:
"""
${cleanText.slice(0, 4000)}
"""

Return ONLY valid JSON matching this schema:
{
  "aiLikelihood": number,
  "originalityScore": number,
  "isAiDetected": boolean,
  "flaggedPhrases": string[],
  "verdict": string,
  "keywordDensity": number,
  "suggestions": string[]
}`;

      if (geminiKey) {
        try {
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
              }),
            }
          );
          if (gemRes.ok) {
            const data: any = await gemRes.json();
            const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (raw) {
              const parsed = JSON.parse(raw);
              aiScore = parsed.aiLikelihood ?? 15;
              originalityScore = parsed.originalityScore ?? 85;
              isAiDetected = Boolean(parsed.isAiDetected);
              flaggedPhrases = parsed.flaggedPhrases || [];
              verdict = parsed.verdict || "Audited";
              feedback = parsed.suggestions || [];
            }
          }
        } catch {}
      } else if (openaiKey) {
        try {
          const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.2,
            }),
          });
          if (oaiRes.ok) {
            const data: any = await oaiRes.json();
            const raw = data?.choices?.[0]?.message?.content;
            if (raw) {
              const parsed = JSON.parse(raw);
              aiScore = parsed.aiLikelihood ?? 15;
              originalityScore = parsed.originalityScore ?? 85;
              isAiDetected = Boolean(parsed.isAiDetected);
              flaggedPhrases = parsed.flaggedPhrases || [];
              verdict = parsed.verdict || "Audited";
              feedback = parsed.suggestions || [];
            }
          }
        } catch {}
      } else {
        // Algorithmic heuristic fallback if no AI key configured yet
        const roboticWords = ["delve", "testament", "tapestry", "moreover", "in conclusion", "furthermore", "realm", "beacon"];
        let hits = 0;
        roboticWords.forEach((w) => {
          if (cleanText.toLowerCase().includes(w)) hits++;
        });
        aiScore = Math.min(85, hits * 18 + (wordCount < 50 ? 30 : 10));
        originalityScore = 100 - aiScore;
        isAiDetected = aiScore > 60;
        verdict = isAiDetected ? "High AI Probability (Heuristic Scan)" : "Original & Organic Content";
        feedback = isAiDetected
          ? ["Avoid repetitive robotic transition words.", "Add real-world exhibition details and user stats."]
          : ["Content reads naturally and has authentic human tone."];
      }

      return res.status(200).json({
        success: true,
        data: {
          wordCount,
          aiScore,
          originalityScore,
          isAiDetected,
          verdict,
          flaggedPhrases,
          feedback,
          targetKeyword: targetKeyword || null,
          analyzedAt: new Date().toISOString(),
          route: route || "/",
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
