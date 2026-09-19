import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import AdvancedSeo from "../../models/advancedSeo.model";

const SEO_FILES_DIR = path.join(process.cwd(), "public", "seo-files");

if (!fs.existsSync(SEO_FILES_DIR)) {
  fs.mkdirSync(SEO_FILES_DIR, { recursive: true });
}

export const advancedSeoController = {
  // GET /api/seo-settings/advanced
  async getAdvancedSeo(_req: Request, res: Response) {
    try {
      let record = await AdvancedSeo.findOne();
      if (!record) {
        record = await AdvancedSeo.create({
          headerScripts: "",
          footerScripts: "",
          seoFiles: [],
          socialLinks: {
            facebook: "https://www.facebook.com/bharatorganicexpo",
            instagram: "https://www.instagram.com/bharatorganicexpo",
            twitter: "https://x.com/organicexpoin",
            youtube: "https://www.youtube.com/@bharatorganicexpo",
            linkedin: "https://www.linkedin.com/company/bharatorganicexpo/",
          },
        });
      }

      const defaultSocial = {
        facebook: "https://www.facebook.com/bharatorganicexpo",
        instagram: "https://www.instagram.com/bharatorganicexpo",
        twitter: "https://x.com/organicexpoin",
        youtube: "https://www.youtube.com/@bharatorganicexpo",
        linkedin: "https://www.linkedin.com/company/bharatorganicexpo/",
      };

      return res.status(200).json({
        success: true,
        data: {
          headerScripts: record.headerScripts || "",
          footerScripts: record.footerScripts || "",
          seoFiles: record.seoFiles || [],
          socialLinks: record.socialLinks || defaultSocial,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch advanced SEO settings",
      });
    }
  },

  // PUT /api/seo-settings/scripts
  async updateScripts(req: Request, res: Response) {
    try {
      const { headerScripts, footerScripts, socialLinks } = req.body;
      let record = await AdvancedSeo.findOne();
      if (!record) {
        record = new AdvancedSeo();
      }

      record.headerScripts = typeof headerScripts === "string" ? headerScripts : record.headerScripts;
      record.footerScripts = typeof footerScripts === "string" ? footerScripts : record.footerScripts;
      if (socialLinks && typeof socialLinks === "object") {
        record.socialLinks = {
          facebook: typeof socialLinks.facebook === "string" ? socialLinks.facebook.trim() : (record.socialLinks?.facebook || ""),
          instagram: typeof socialLinks.instagram === "string" ? socialLinks.instagram.trim() : (record.socialLinks?.instagram || ""),
          twitter: typeof socialLinks.twitter === "string" ? socialLinks.twitter.trim() : (record.socialLinks?.twitter || ""),
          youtube: typeof socialLinks.youtube === "string" ? socialLinks.youtube.trim() : (record.socialLinks?.youtube || ""),
          linkedin: typeof socialLinks.linkedin === "string" ? socialLinks.linkedin.trim() : (record.socialLinks?.linkedin || ""),
        };
      }
      record.updatedBy = (req as any).user?.name || "Admin User";

      await record.save();

      return res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: {
          headerScripts: record.headerScripts,
          footerScripts: record.footerScripts,
          seoFiles: record.seoFiles,
          socialLinks: record.socialLinks,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update scripts",
      });
    }
  },

  // PUT /api/seo-settings/social-links
  async updateSocialLinks(req: Request, res: Response) {
    try {
      const { facebook, instagram, twitter, youtube, linkedin } = req.body;
      let record = await AdvancedSeo.findOne();
      if (!record) {
        record = new AdvancedSeo();
      }

      record.socialLinks = {
        facebook: typeof facebook === "string" ? facebook.trim() : (record.socialLinks?.facebook || ""),
        instagram: typeof instagram === "string" ? instagram.trim() : (record.socialLinks?.instagram || ""),
        twitter: typeof twitter === "string" ? twitter.trim() : (record.socialLinks?.twitter || ""),
        youtube: typeof youtube === "string" ? youtube.trim() : (record.socialLinks?.youtube || ""),
        linkedin: typeof linkedin === "string" ? linkedin.trim() : (record.socialLinks?.linkedin || ""),
      };
      record.updatedBy = (req as any).user?.name || "Admin User";

      await record.save();

      return res.status(200).json({
        success: true,
        message: "Social media links updated successfully",
        data: record.socialLinks,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update social media links",
      });
    }
  },

  // POST /api/seo-settings/upload-file
  async uploadFile(req: Request, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const originalName = file.originalname;
      const ext = path.extname(originalName).toLowerCase().replace(".", "");
      if (!["xml", "html", "txt"].includes(ext)) {
        return res.status(400).json({
          success: false,
          message: "Only .xml, .html, and .txt files are allowed",
        });
      }

      // Clean file name to prevent directory traversal
      const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetPath = path.join(SEO_FILES_DIR, safeName);

      // Write file buffer to public/seo-files/
      fs.writeFileSync(targetPath, file.buffer);

      let record = await AdvancedSeo.findOne();
      if (!record) {
        record = new AdvancedSeo();
      }

      // Remove existing entry with same safeName if exists
      record.seoFiles = record.seoFiles.filter(
        (f: any) => f.fileName !== safeName && f.originalName !== originalName
      );

      // Add new file record
      record.seoFiles.push({
        originalName,
        fileName: safeName,
        filePath: `/seo-files/${safeName}`,
        fileType: ext,
        size: file.size,
        uploadedAt: new Date(),
      });

      await record.save();

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        data: record.seoFiles,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to upload file",
      });
    }
  },

  // DELETE /api/seo-settings/file/:fileId
  async deleteFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      let record = await AdvancedSeo.findOne();
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "No SEO settings record found",
        });
      }

      const targetFile = record.seoFiles.find(
        (f: any) => f._id?.toString() === fileId || f.fileName === fileId
      );

      if (targetFile) {
        const filePathOnDisk = path.join(SEO_FILES_DIR, targetFile.fileName);
        if (fs.existsSync(filePathOnDisk)) {
          try {
            fs.unlinkSync(filePathOnDisk);
          } catch {}
        }

        record.seoFiles = record.seoFiles.filter(
          (f: any) => f._id?.toString() !== fileId && f.fileName !== fileId
        );
        await record.save();
      }

      return res.status(200).json({
        success: true,
        message: "File deleted successfully",
        data: record.seoFiles,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete file",
      });
    }
  },
};
