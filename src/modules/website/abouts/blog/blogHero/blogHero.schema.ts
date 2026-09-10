import { z } from "zod";

export const blogHeroSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

export type BlogHeroInput = z.infer<typeof blogHeroSchema>["body"];
