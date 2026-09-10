import { z } from "zod";

export const whyParticipateSchema = z.object({
  body: z.object({
    sectionTag: z.string().optional(),
    titleMain: z.string().optional(),
    titleHighlight: z.string().optional(),
    description: z.string().optional(),
    points: z.any().optional(),
    imageAlt: z.string().optional(),
    imageBadgeText: z.string().optional(),
    mainPoints: z.any().optional(),
    buttons: z.any().optional(),
  }),
});

export type WhyParticipateInput = z.infer<typeof whyParticipateSchema>["body"];
