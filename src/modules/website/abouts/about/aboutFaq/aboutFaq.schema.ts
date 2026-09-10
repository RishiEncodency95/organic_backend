import { z } from "zod";

export const aboutFaqSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    subtitle: z.string().optional(),
    faqs: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type AboutFaqInput = z.infer<typeof aboutFaqSchema>["body"];
