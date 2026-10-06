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
    // Sent by the chat's quotation / callback forms
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address").max(100)]).optional(),
    enquiryType: z.enum(["stall-quotation", "sales-callback"]).optional(),
    stallSize: z.string().trim().max(30).optional(),
    company: z.string().trim().max(100).optional(),
    preferredTime: z.string().trim().max(60).optional(),
  }),
});

// Previous chats of a visitor who verified this mobile number / email with OTP
export const chatHistorySchema = z.object({
  body: z
    .object({
      phone: z
        .string()
        .trim()
        .refine((v) => /^[6-9]\d{9}$/.test(toTenDigitMobile(v)), "Enter a valid 10-digit mobile number")
        .optional(),
      email: z.string().trim().toLowerCase().email("Enter a valid email address").max(100).optional(),
    })
    .refine((b) => b.phone || b.email, "Mobile number or email is required"),
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

// What a visitor does in the chat before (or besides) talking to the AI: topic / option clicks,
// the scripted replies they saw, a question waiting for the details form, and 👍 / 👎 feedback
export const chatTrackSchema = z.object({
  body: z
    .object({
      sessionId,
      pageUrl,
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(2000),
          })
        )
        .max(10)
        .optional(),
      feedback: z.enum(["yes", "no"]).optional(),
    })
    .refine((b) => b.messages?.length || b.feedback, "Nothing to save"),
});
