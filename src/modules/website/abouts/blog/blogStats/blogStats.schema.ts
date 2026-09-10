import { z } from "zod";

export const blogStatsSchema = z.object({
  body: z.object({
    stats: z.array(z.object({
      icon: z.string().optional(),
      value: z.number().optional(),
      suffix: z.string().optional(),
      label: z.string().optional(),
    })).optional(),
  }),
});

export type BlogStatsInput = z.infer<typeof blogStatsSchema>["body"];
