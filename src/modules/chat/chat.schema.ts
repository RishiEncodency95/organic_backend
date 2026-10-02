import { z } from "zod";

/** "+91 98765-43210" / "098765 43210" → "9876543210" */
export const toTenDigitMobile = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

const sessionId =z.string().trim().min(1, "sessionId is required").max(100, "sessionId is too long");
const pageUrl = z.string().max(500).optional();

export const chatLeadSchema = z.object({
  body: z.object({
    sessionId,
    pageUrl,
    // Letters only (any language), with spaces, dots, apostrophes or hyphens — no digits
    name: z
      .string()
      .trim()
      .min(2, "Name is required")
      .max(60, "Name is too long")
      .regex(/^\p{L}[\p{L}\p{M} .'-]*$/u, "Name can only contain letters"),
    // 10-digit Indian mobile number (a leading +91 / 91 / 0 is accepted and dropped)
    phone: z
      .string()
      .trim()
      .refine((v) => /^[6-9]\d{9}$/.test(toTenDigitMobile(v)), "Enter a valid 10-digit mobile number"),
  }),
});

export const chatMessageSchema = z.object({
  body: z.object({
    sessionId,
    pageUrl,
    message: z
      .string()
      .trim()
      .min(1, "Message is required")
      .max(1000, "Message must be at most 1000 characters"),
  }),
});
