import { z } from "zod";

export const beyondExhibitionSchema = z.object({
  body: z.object({
    enabled: z.boolean().or(z.string()).optional(),
    sectionTag: z.string().optional(),
    titleMain: z.string().optional(),
    titleHighlight: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    items: z.any().optional(),
    extras: z.any().optional(),
  }),
});

export type BeyondExhibitionInput = z.infer<typeof beyondExhibitionSchema>["body"];
