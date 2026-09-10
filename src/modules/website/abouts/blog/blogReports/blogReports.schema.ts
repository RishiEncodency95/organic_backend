import { z } from "zod";

export const blogReportsSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    actionText: z.string().optional(),
    reports: z.array(z.object({
      title: z.string().optional(),
      meta: z.string().optional(),
    })).optional(),
  }),
});

export type BlogReportsInput = z.infer<typeof blogReportsSchema>["body"];
