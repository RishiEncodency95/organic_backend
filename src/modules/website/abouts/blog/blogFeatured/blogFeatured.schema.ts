import { z } from "zod";

export const blogFeaturedSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    actionText: z.string().optional(),
    articles: z.array(z.object({
      tag: z.string().optional(),
      img: z.string().optional(),
      title: z.string().optional(),
      desc: z.string().optional(),
      date: z.string().optional(),
      read: z.string().optional(),
    })).optional(),
  }),
});

export type BlogFeaturedInput = z.infer<typeof blogFeaturedSchema>["body"];
