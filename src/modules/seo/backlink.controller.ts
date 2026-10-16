import { Request, Response } from "express";
import { Backlink } from "../../models/Backlink.model";
import { ActivityLog } from "../../models/ActivityLog.model";
import * as XLSX from "xlsx";

export const backlinkController = {
  // 1. Get Backlinks with pagination, search, and summary stats
  getBacklinks: async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || "";
      const status = req.query.status as string;
      const type = req.query.type as string;

      const query: any = {};
      if (search) {
        query.$or = [
          { targetUrl: { $regex: search, $options: "i" } },
          { sourceUrl: { $regex: search, $options: "i" } },
          { anchorText: { $regex: search, $options: "i" } },
        ];
      }
      if (status) query.status = status;
      if (type) query.type = type;

      const total = await Backlink.countDocuments(query);
      const backlinks = await Backlink.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      // Compute total metrics across entire DB
      const totalCount = await Backlink.countDocuments();
      const activeCount = await Backlink.countDocuments({ status: "active" });
      const lostCount = await Backlink.countDocuments({ status: "lost" });
      const brokenCount = await Backlink.countDocuments({ status: "broken" });
      const dofollowCount = await Backlink.countDocuments({ type: "dofollow" });
      const nofollowCount = await Backlink.countDocuments({ type: "nofollow" });

      return res.status(200).json({
        success: true,
        data: backlinks,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: totalCount,
          active: activeCount,
          lost: lostCount,
          broken: brokenCount,
          dofollow: dofollowCount,
          nofollow: nofollowCount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 2. Create single backlink
  createBacklink: async (req: Request, res: Response) => {
    try {
      const { targetUrl, sourceUrl, anchorText, type, daScore, status, notes } = req.body;
      if (!targetUrl || !sourceUrl) {
        return res.status(400).json({ success: false, message: "Target URL and Source URL are required." });
      }

      const backlink = await Backlink.create({
        targetUrl,
        sourceUrl,
        anchorText: anchorText || "",
        type: type || "dofollow",
        daScore: Number(daScore) || 0,
        status: status || "active",
        notes: notes || "",
        createdBy: (req as any).user?.name || "Admin",
      });

      // Log in ActivityLog
      await ActivityLog.create({
        userName: (req as any).user?.name || "Admin",
        action: "Created",
        module: "SEO Backlinks",
        url: "/seo",
        method: "POST",
        apiPath: req.originalUrl,
        ip: req.ip || "127.0.0.1",
        status: "Success",
        statusCode: 201,
        details: `Added new backlink from ${sourceUrl} to ${targetUrl}`,
        changes: [{ entity: "Backlink", entityId: String(backlink._id), operation: "created", after: backlink.toObject() as any }],
      }).catch(() => undefined);

      return res.status(201).json({ success: true, data: backlink });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 3. Bulk Upload via Excel / CSV buffer or array
  uploadExcel: async (req: Request, res: Response) => {
    try {
      let rows: any[] = [];

      if (req.file) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet);
      } else if (Array.isArray(req.body.items)) {
        rows = req.body.items;
      } else {
        return res.status(400).json({ success: false, message: "Please provide an Excel file or JSON rows array." });
      }

      if (!rows.length) {
        return res.status(400).json({ success: false, message: "No data found in uploaded sheet." });
      }

      const validLinks: any[] = [];
      const user = (req as any).user?.name || "Admin";

      for (const row of rows) {
        const targetUrl = row.targetUrl || row["Target URL"] || row["Target"] || row["TargetUrl"] || "";
        const sourceUrl = row.sourceUrl || row["Source URL"] || row["Backlink URL"] || row["Source"] || row["SourceUrl"] || "";
        const anchorText = row.anchorText || row["Anchor Text"] || row["Anchor"] || "";
        const rawType = (row.type || row["Type"] || "dofollow").toString().toLowerCase().trim();
        const type = rawType.includes("no") ? "nofollow" : "dofollow";
        const daScore = Number(row.daScore || row["DA Score"] || row["DA"] || row["Score"] || 0);
        const rawStatus = (row.status || row["Status"] || "active").toString().toLowerCase().trim();
        const status = ["active", "lost", "broken"].includes(rawStatus) ? rawStatus : "active";
        const notes = row.notes || row["Notes"] || "";

        if (targetUrl && sourceUrl) {
          validLinks.push({
            targetUrl: String(targetUrl).trim(),
            sourceUrl: String(sourceUrl).trim(),
            anchorText: String(anchorText).trim(),
            type,
            daScore: isNaN(daScore) ? 0 : Math.min(100, Math.max(0, daScore)),
            status,
            notes: String(notes).trim(),
            createdBy: user,
          });
        }
      }

      if (!validLinks.length) {
        return res.status(400).json({
          success: false,
          message: "No valid rows found. Please ensure headers have Target URL and Source URL.",
        });
      }

      const inserted = await Backlink.insertMany(validLinks, { ordered: false });

      // Log in ActivityLog
      await ActivityLog.create({
        userName: user,
        action: "Imported",
        module: "SEO Backlinks",
        url: "/seo",
        method: "POST",
        apiPath: req.originalUrl,
        ip: req.ip || "127.0.0.1",
        status: "Success",
        statusCode: 200,
        details: `Imported ${inserted.length} backlinks via Excel sheet upload`,
      }).catch(() => undefined);

      return res.status(200).json({
        success: true,
        message: `Successfully uploaded and saved ${inserted.length} backlinks.`,
        count: inserted.length,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 4. Export Backlinks to Excel sheet buffer
  exportExcel: async (_req: Request, res: Response) => {
    try {
      const backlinks = await Backlink.find().sort({ createdAt: -1 }).lean();
      const exportData = backlinks.map((item, index) => ({
        "S.No": index + 1,
        "Target URL": item.targetUrl,
        "Source Backlink URL": item.sourceUrl,
        "Anchor Text": item.anchorText || "N/A",
        "Link Type": item.type,
        "DA Score": item.daScore || 0,
        "Status": item.status,
        "Notes": item.notes || "",
        "Created Date": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Backlinks");
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Disposition", 'attachment; filename="bharat_organic_backlinks.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(excelBuffer);
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // 5. Delete backlink
  deleteBacklink: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await Backlink.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Backlink not found." });
      }

      await ActivityLog.create({
        userName: (req as any).user?.name || "Admin",
        action: "Deleted",
        module: "SEO Backlinks",
        url: "/seo",
        method: "DELETE",
        apiPath: req.originalUrl,
        ip: req.ip || "127.0.0.1",
        status: "Success",
        statusCode: 200,
        details: `Deleted backlink ${deleted.sourceUrl}`,
      }).catch(() => undefined);

      return res.status(200).json({ success: true, message: "Backlink removed successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
