import { Request, Response } from "express";
import CareerResultMessages, {
  DEFAULT_RESULT_MESSAGES,
  RESULT_MESSAGE_TYPES,
} from "../../models/careers/CareerResultMessages.model";

const FIELDS = ["title", "subtitle", "web", "email", "sms", "whatsapp"] as const;

const getOrCreate = async () => {
  let doc = await CareerResultMessages.findOne({ key: "default" });
  if (!doc) doc = await CareerResultMessages.create({ key: "default" });
  return doc;
};

const toPayload = (doc: any) => {
  const out: Record<string, any> = {
    supportEmail: doc.supportEmail,
    supportPhone: doc.supportPhone,
    updatedAt: doc.updatedAt,
  };
  for (const type of RESULT_MESSAGE_TYPES) {
    const saved = doc[type]?.toObject ? doc[type].toObject() : doc[type] || {};
    out[type] = { ...DEFAULT_RESULT_MESSAGES[type], ...saved };
  }
  return out;
};

// GET /careers/result-messages (public: the careers eligibility result reads it)
// GET /careers/admin/result-messages
export const getResultMessages = async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await getOrCreate();
    res.status(200).json({ success: true, data: toPayload(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load result messages.", error: (error as Error).message });
  }
};

// PUT /careers/admin/result-messages
export const updateResultMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const doc: any = await getOrCreate();

    for (const type of RESULT_MESSAGE_TYPES) {
      const incoming = body[type];
      if (!incoming || typeof incoming !== "object") continue;
      const current = doc[type]?.toObject ? doc[type].toObject() : doc[type] || {};
      const next: Record<string, any> = { ...DEFAULT_RESULT_MESSAGES[type], ...current };
      if (typeof incoming.active === "boolean") next.active = incoming.active;
      for (const f of FIELDS) {
        if (typeof incoming[f] === "string") next[f] = incoming[f];
      }
      doc[type] = next;
    }
    if (typeof body.supportEmail === "string") doc.supportEmail = body.supportEmail.trim();
    if (typeof body.supportPhone === "string") doc.supportPhone = body.supportPhone.trim();

    await doc.save();
    res.status(200).json({ success: true, message: "Result messages saved.", data: toPayload(doc) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to save result messages.", error: (error as Error).message });
  }
};
