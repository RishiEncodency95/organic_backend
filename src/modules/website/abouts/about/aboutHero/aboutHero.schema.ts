import { z } from "zod";

export const aboutHeroSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    imageAlt: z.string().optional(),
    buttons: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type AboutHeroInput = z.infer<typeof aboutHeroSchema>["body"];
