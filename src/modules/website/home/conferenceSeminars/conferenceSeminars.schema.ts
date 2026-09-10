import { z } from "zod";

export const conferenceSeminarsSchema = z.object({
  body: z.object({
    sectionTag: z.string().optional(),
    titleMain: z.string().optional(),
    titleHighlight: z.string().optional(),
    description: z.string().optional(),
    checklist: z.any().optional(),
    button: z.any().optional(),
    eventInfo: z.any().optional(),
    imageAlt: z.string().optional(),
  }),
});

export type ConferenceSeminarsInput = z.infer<typeof conferenceSeminarsSchema>["body"];
