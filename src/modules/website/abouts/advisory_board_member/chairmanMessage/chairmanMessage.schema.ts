import { z } from "zod";

export const chairmanMessageSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    paragraphs: z.any().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    visionTagline: z.string().optional(),
    visionText: z.string().optional(),
  }),
});

export type ChairmanMessageInput = z.infer<typeof chairmanMessageSchema>["body"];
