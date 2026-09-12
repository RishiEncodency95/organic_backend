import { z } from "zod";

export const audienceStripItemSchema = z.object({
  _id: z.string().optional(),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  label: z.string().optional(),
  icon: z.string().default("GraduationCap"),
  color: z.string().default("text-orange-500"),
  order: z.number().optional(),
});

export const audienceStripSchema = z.object({
  enabled: z.boolean().default(true),
  items: z.array(audienceStripItemSchema).default([]),
});
