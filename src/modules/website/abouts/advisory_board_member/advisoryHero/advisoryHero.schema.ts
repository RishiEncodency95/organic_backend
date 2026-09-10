import { z } from "zod";

export const advisoryHeroSchema = z.object({
  body: z.object({
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    subtitlePart1: z.string().optional(),
    subtitlePart2: z.string().optional(),
    description: z.string().optional(),
    imageAlt: z.string().optional(),
    features: z.any().optional(),
  }),
});

export type AdvisoryHeroInput = z.infer<typeof advisoryHeroSchema>["body"];
