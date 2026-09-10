import { z } from "zod";

export const introductionSectionSchema = z.object({
  body: z.object({
    bgColor: z.string().optional(),
    subtitle: z.string().optional(),
    title: z.any().optional(),
    paragraphs: z.any().optional(),
    button: z.any().optional(),
    imageAlt: z.string().optional(),
  }),
});

export type IntroductionSectionInput = z.infer<typeof introductionSectionSchema>["body"];
