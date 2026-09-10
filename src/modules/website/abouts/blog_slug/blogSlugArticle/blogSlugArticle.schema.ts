import { z } from "zod";

export const blogSlugArticleSchema = z.object({
  body: z.object({
    breadcrumbs: z.array(z.object({
      label: z.string().optional(),
      href: z.string().optional(),
    })).optional(),
    category: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    meta: z.object({
      date: z.string().optional(),
      readTime: z.string().optional(),
      views: z.string().optional(),
    }).optional(),
    paragraphs: z.array(z.string()).optional(),
    sections: z.array(z.object({
      id: z.number().optional(),
      title: z.string().optional(),
      content: z.string().optional(),
      type: z.string().optional(),
      statsData: z.array(z.object({
        icon: z.string().optional(),
        value: z.string().optional(),
        label: z.string().optional(),
      })).optional(),
      listData: z.array(z.object({
        title: z.string().optional(),
        desc: z.string().optional(),
      })).optional(),
      cardsData: z.array(z.object({
        icon: z.string().optional(),
        title: z.string().optional(),
        desc: z.string().optional(),
      })).optional(),
      quoteData: z.object({
        main: z.string().optional(),
        sub: z.string().optional(),
      }).optional(),
    })).optional(),
  }),
});

export type BlogSlugArticleInput = z.infer<typeof blogSlugArticleSchema>["body"];
