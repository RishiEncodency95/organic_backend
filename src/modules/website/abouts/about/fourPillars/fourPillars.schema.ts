import { z } from "zod";

export const fourPillarsSchema = z.object({
  body: z.object({
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    enabled: z.boolean().optional(),
    pillars: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type FourPillarsInput = z.infer<typeof fourPillarsSchema>["body"];
