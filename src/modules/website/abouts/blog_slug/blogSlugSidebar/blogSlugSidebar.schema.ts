import { z } from "zod";

export const blogSlugSidebarSchema = z.object({
  body: z.object({
    author: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
    relatedArticles: z.array(z.object({
      title: z.string().optional(),
      date: z.string().optional(),
      image: z.string().optional(),
    })).optional(),
    categories: z.array(z.object({
      name: z.string().optional(),
      active: z.boolean().optional(),
    })).optional(),
  }),
});

export type BlogSlugSidebarInput = z.infer<typeof blogSlugSidebarSchema>["body"];
