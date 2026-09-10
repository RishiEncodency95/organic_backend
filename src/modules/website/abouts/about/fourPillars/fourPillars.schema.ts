import { z } from "zod";

export const fourPillarsSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    pillars: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type FourPillarsInput = z.infer<typeof fourPillarsSchema>["body"];
