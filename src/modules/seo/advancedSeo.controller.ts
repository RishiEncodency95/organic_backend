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
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          headerScripts: record.headerScripts || "",
          footerScripts: record.footerScripts || "",
          seoFiles: record.seoFiles || [],
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
      const { headerScripts, footerScripts } = req.body;
      let record = await AdvancedSeo.findOne();
      if (!record) {
        record = new AdvancedSeo();
      }

      record.headerScripts = typeof headerScripts === "string" ? headerScripts : record.headerScripts;
      record.footerScripts = typeof footerScripts === "string" ? footerScripts : record.footerScripts;
      record.updatedBy = (req as any).user?.name || "Admin User";

      await record.save();

      return res.status(200).json({
        success: true,
        message: "Global scripts updated successfully",
        data: {
          headerScripts: record.headerScripts,
          footerScripts: record.footerScripts,
          seoFiles: record.seoFiles,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update scripts",
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
