import { z } from "zod";

export const blogExpertsSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    actionText: z.string().optional(),
    experts: z.array(z.object({
      name: z.string().optional(),
      role: z.string().optional(),
      quote: z.string().optional(),
      img: z.string().optional(),
    })).optional(),
  }),
});

export type BlogExpertsInput = z.infer<typeof blogExpertsSchema>["body"];
