import { z } from "zod";

export const homeAboutSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    title: z.string().optional(),
    imageAlt: z.string().optional(),
    paragraphs: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type HomeAboutInput = z.infer<typeof homeAboutSchema>["body"];
