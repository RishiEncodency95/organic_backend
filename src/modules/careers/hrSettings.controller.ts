import { Request, Response } from "express";
import CareerHrSettings, { RECIPIENT_TYPES } from "../../models/careers/CareerHrSettings.model";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getHrSettingsDoc = async () => {
  let doc = await CareerHrSettings.findOne({ key: "default" });
  if (!doc) doc = await CareerHrSettings.create({ key: "default" });
  return doc;
};

const toPayload = (doc: any) => ({
  recipients: (doc.recipients || []).map((r: any) => ({
    id: String(r._id),
    name: r.name || "",
    designation: r.designation || "",
    email: r.email,
    type: r.type || "to",
    active: r.active !== false,
  })),
  manualForward: doc.manualForward !== false,
  notifyHr: doc.notifyHr !== false,
  updatedAt: doc.updatedAt,
});

// GET /careers/admin/hr-settings
export const getHrSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getHrSettingsDoc();
    res.status(200).json({ success: true, data: toPayload(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load HR settings.", error: (error as Error).message });
  }
};

// PUT /careers/admin/hr-settings
export const updateHrSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const doc: any = await getHrSettingsDoc();

    if (Array.isArray(body.recipients)) {
      const seen = new Set<string>();
      const recipients = [];
      for (const r of body.recipients) {
        const email = typeof r?.email === "string" ? r.email.trim().toLowerCase() : "";
        if (!email) continue;
        if (!EMAIL_RE.test(email)) {
          res.status(400).json({ success: false, message: `"${email}" is not a valid email address.` });
          return;
        }
        if (seen.has(email)) {
          res.status(400).json({ success: false, message: `${email} is added more than once.` });
          return;
        }
        seen.add(email);
        recipients.push({
          name: typeof r.name === "string" ? r.name.trim() : "",
          designation: typeof r.designation === "string" ? r.designation.trim() : "",
          email,
          type: RECIPIENT_TYPES.includes(r.type) ? r.type : "to",
          active: r.active !== false,
        });
      }
      if (recipients.length > 0 && !recipients.some((r) => r.active && r.type === "to")) {
        res.status(400).json({ success: false, message: "Keep at least one active recipient in \"To\"." });
        return;
      }
      doc.recipients = recipients;
    }
    if (typeof body.manualForward === "boolean") doc.manualForward = body.manualForward;
    if (typeof body.notifyHr === "boolean") doc.notifyHr = body.notifyHr;

    await doc.save();
    res.status(200).json({ success: true, message: "HR settings saved.", data: toPayload(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to save HR settings.", error: (error as Error).message });
  }
};
