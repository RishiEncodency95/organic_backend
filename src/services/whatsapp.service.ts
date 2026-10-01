import { logger } from "../utils/logger";

const AISENSY_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

/** Indian 10-digit numbers get the 91 country code; anything else is sent as digits only. */
export const toWhatsAppNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

/**
 * Sends an approved AiSensy campaign (WhatsApp template) to one number.
 * Returns false instead of throwing, so a WhatsApp failure never breaks the caller.
 */
export const sendWhatsAppTemplate = async (opts: {
  campaignName: string;
  phone: string;
  userName: string;
  templateParams: string[];
  source: string;
}): Promise<boolean> => {
  const apiKey = process.env.AISENSY_API_KEY || process.env.OPUS_API_KEY;
  if (!apiKey) {
    logger.warn("WhatsApp not sent: AISENSY_API_KEY is missing");
    return false;
  }

  try {
    const res = await fetch(AISENSY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        campaignName: opts.campaignName,
        destination: toWhatsAppNumber(opts.phone),
        userName: opts.userName || "User",
        templateParams: opts.templateParams,
        source: opts.source,
      }),
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body — treated as a failure below.
    }
    // AiSensy reports success as the string "true".
    const accepted = res.ok && String(parsed?.success) === "true";
    if (!accepted) {
      logger.warn(`WhatsApp campaign "${opts.campaignName}" rejected (HTTP ${res.status}): ${text}`);
    }
    return accepted;
  } catch (error: any) {
    logger.warn(`WhatsApp campaign "${opts.campaignName}" failed: ${error?.message}`);
    return false;
  }
};
