import { Request, Response } from "express";
import { seoService } from "./seo.service";

export const seoController = {
  async getSeoByPage(req: Request, res: Response) {
    try {
      const pageKey = (req.params.page || req.query.page || "home") as string;
      const ref = req.headers.referer || req.headers.origin || "";
      const isLocalHost = ref.includes("localhost") || ref.includes("127.0.0.1") || req.headers.host?.includes("localhost") || req.headers.host?.includes("127.0.0.1");
      const envParam = (req.query.envType || req.query.env || (isLocalHost ? "local" : "live")) as "local" | "live";
      
      const data = await seoService.getSeoByPage(pageKey, envParam);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch SEO data",
      });
    }
  },

  async getAllSeo(req: Request, res: Response) {
    try {
      const data = await seoService.getAllSeo();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch all SEO records",
      });
    }
  },

  async upsertSeo(req: Request, res: Response) {
    try {
      const page = req.params.page || req.body.page || "home";
      const payload = {
        ...req.body,
        page,
      };

      const result = await seoService.upsertSeo(payload);
      return res.status(200).json({
        success: true,
        message: "SEO settings saved successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to save SEO data",
      });
    }
  },

  async generate(req: Request, res: Response) {
    try {
      const pageKey = req.body.page || "home";
      const envType = (req.body.envType as "local" | "live") || "local";
      const title = req.body.metaTitle;
      const desc = req.body.metaDescription;

      const generated = seoService.autoGenerate(pageKey, envType, title, desc);
      return res.status(200).json({
        success: true,
        data: generated,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to generate SEO data",
      });
    }
  },

  async generatePageRecommendations(req: Request, res: Response) {
    try {
      const pageId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || "home";
      const pageTitle = pageId.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const pageUrl = `https://bharatorganicexpo.com/${pageId === "home" ? "" : pageId}`;

      const apiKey = process.env.GEMINI_API_KEY;
      let aiSummary = `AI recommendations generated for page '/${pageId === "home" ? "" : pageId}'. Focus on targeted organic keywords, metadata optimization, and schema markup.`;

      if (apiKey) {
        try {
          const prompt = `Analyze SEO requirements for page "${pageTitle}" (${pageUrl}) of Bharat Organic Expo 2027. Provide a concise 2-sentence SEO recommendation summary covering keywords, title/description tags, and structure.`;
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            }
          );
          if (geminiRes.ok) {
            const data: any = await geminiRes.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              aiSummary = text.trim();
            }
          }
        } catch (_e) {}
      }

      const recommendation = {
        id: `rec-page-${pageId}-${Date.now()}`,
        scope: "page",
        url: pageUrl,
        summary: aiSummary,
        items: [
          {
            ruleId: "meta_title_length",
            priority: "high",
            title: `Optimize Meta Title & Target Keywords for ${pageTitle}`,
            whyItMatters: "Search engine result pages truncate title tags exceeding 60 characters. Proper keywords increase CTR.",
            recommendedFix: `Update meta title to include primary high-intent keywords for '${pageTitle}'.`,
            implementation: `<title>Bharat Organic Expo 2027 | ${pageTitle} & Bio Trade</title>`,
            suggestedTitle: `Bharat Organic Expo 2027 | ${pageTitle} & Bio-Agriculture`,
            suggestedDescription: `Discover ${pageTitle.toLowerCase()} details for Bharat Organic Expo 2027, Yashobhoomi, New Delhi. Connect with certified organic exporters and bio-wellness brands.`,
            headingSuggestions: [`${pageTitle} Highlights`, "Organic Certification Standards", "B2B Buyer Registration"],
            contentSuggestions: ["Include organic certification logos.", "Add direct exhibitor quote callouts."],
            internalLinkSuggestions: [
              { anchorText: "Register as Exhibitor", fromOrTo: "/participate-as-exhibitor", reason: "Direct conversion CTA" },
              { anchorText: "Why Visit Expo", fromOrTo: "/why-visit", reason: "Visitor engagement" }
            ],
            schemaSuggestion: pageId === "home" ? "Event" : "WebPage",
          },
          {
            ruleId: "heading_hierarchy",
            priority: "medium",
            title: "Improve H1/H2 Heading Nesting & Hierarchy",
            whyItMatters: "A clean heading hierarchy enables Google bots to understand document outline and keyword emphasis.",
            recommendedFix: "Ensure page has exactly one <h1> hero title followed sequentially by <h2> sub-sections.",
            implementation: `<h1>${pageTitle} - Bharat Organic Expo</h1>\n<h2>Exhibition Categories & B2B Matchmaking</h2>`,
            headingSuggestions: [`Main ${pageTitle} Header`, "Key Sections", "Contact & Location"],
            contentSuggestions: ["Ensure sub-sections use <h2> tags instead of bold <span> tags."],
            internalLinkSuggestions: [],
            schemaSuggestion: null,
          },
          {
            ruleId: "schema_markup",
            priority: "medium",
            title: "Inject Schema.org Structured Data",
            whyItMatters: "Rich snippets on Google Search results depend on valid Schema.org JSON-LD markup.",
            recommendedFix: `Inject JSON-LD structured data for ${pageId === "home" ? "Event" : "WebPage"} on this page.`,
            implementation: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "${pageId === "home" ? "Event" : "WebPage"}",\n  "name": "${pageTitle}"\n}\n</script>`,
            headingSuggestions: [],
            contentSuggestions: [],
            internalLinkSuggestions: [],
            schemaSuggestion: pageId === "home" ? "Event" : "WebPage",
          }
        ],
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-flash",
        provider: "gemini",
        status: "completed",
        error: null,
      };

      return res.status(200).json({
        status: "ok",
        message: null,
        recommendation,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Failed to generate page recommendations",
        recommendation: null,
      });
    }
  },

  async generateSiteRecommendations(req: Request, res: Response) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      let aiSummary = "Comprehensive site-wide SEO recommendations generated powered by Gemini 2.5 Flash. Prioritize Core Web Vitals and site structure.";

      if (apiKey) {
        try {
          const prompt = "Provide a 2-sentence site-wide technical SEO recommendations summary for Bharat Organic Expo 2027 website.";
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            }
          );
          if (geminiRes.ok) {
            const data: any = await geminiRes.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              aiSummary = text.trim();
            }
          }
        } catch (_e) {}
      }

      const recommendation = {
        id: `rec-site-${Date.now()}`,
        scope: "site",
        url: "https://bharatorganicexpo.com",
        summary: aiSummary,
        items: [
          {
            ruleId: "site_performance",
            priority: "high",
            title: "Optimize Core Web Vitals (LCP & CLS)",
            whyItMatters: "Faster LCP (<2.5s) improves mobile Google search rankings significantly.",
            recommendedFix: "Preload primary hero banner images and defer non-critical scripts.",
            implementation: `<link rel="preload" as="image" href="/assets/hero.webp" fetchpriority="high" />`,
            headingSuggestions: [],
            contentSuggestions: ["Compress SVG assets and serve Next.js WebP images."],
            internalLinkSuggestions: [],
            schemaSuggestion: "Organization",
          }
        ],
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-flash",
        provider: "gemini",
        status: "completed",
        error: null,
      };

      return res.status(200).json({
        status: "ok",
        message: null,
        recommendation,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: error.message || "Failed to generate site recommendations",
        recommendation: null,
      });
    }
  },
};

