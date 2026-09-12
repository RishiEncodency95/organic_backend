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
};
