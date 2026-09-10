import { z } from "zod";

export const blogSidebarSchema = z.object({
  body: z.object({
    categoriesTitle: z.string().optional(),
    viewAllCategoriesText: z.string().optional(),
    categories: z.array(z.object({
      icon: z.string().optional(),
      label: z.string().optional(),
      count: z.number().optional(),
      color: z.string().optional(),
    })).optional(),
    newsletter: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      inputPlaceholder: z.string().optional(),
      buttonText: z.string().optional(),
      subscribedText: z.string().optional(),
      footerText: z.string().optional(),
    }).optional(),
  }),
});

export type BlogSidebarInput = z.infer<typeof blogSidebarSchema>["body"];
