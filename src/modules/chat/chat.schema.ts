import { z } from "zod";

const sessionId = z.string().trim().min(1, "sessionId is required").max(100, "sessionId is too long");
const pageUrl = z.string().max(500).optional();

export const chatLeadSchema = z.object({
  body: z.object({
    sessionId,
    pageUrl,
    name: z.string().trim().min(2, "Name is required").max(100),
    email: z.string().trim().email("Valid email is required").max(150),
    // 10-digit Indian mobile, or an international number with country code
    phone: z
      .string()
      .trim()
      .refine((v) => /^\d{10,15}$/.test(v.replace(/[\s+()-]/g, "")), "Valid phone number is required"),
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
