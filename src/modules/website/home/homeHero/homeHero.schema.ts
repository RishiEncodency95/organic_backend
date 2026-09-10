import { z } from "zod";

export const homeHeroSchema = z.object({
  body: z.object({
    alt: z.string().optional(),
    tagline: z.string().optional(),
    titlePrimary: z.string().optional(),
    titleSecondary: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    button1Name: z.string().optional(),
    button1Link: z.string().optional(),
    button2Name: z.string().optional(),
    button2Link: z.string().optional(),
  }),
});

export type HomeHeroInput = z.infer<typeof homeHeroSchema>["body"];
