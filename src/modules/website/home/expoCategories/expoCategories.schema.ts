import { z } from "zod";

export const expoCategoriesSchema = z.object({
  body: z.object({
    sectionTag: z.string().optional(),
    titleMain: z.string().optional(),
    titleHighlight: z.string().optional(),
    descriptionPrefix: z.string().optional(),
    description: z.string().optional(),
    exploreText: z.string().optional(),
    buttonText: z.string().optional(),
    categories: z.any().optional(),
  }),
});

export type ExpoCategoriesInput = z.infer<typeof expoCategoriesSchema>["body"];
