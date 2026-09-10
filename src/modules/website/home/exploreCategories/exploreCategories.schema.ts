import { z } from "zod";

export const exploreCategoriesSchema = z.object({
  body: z.object({
    categoryname: z.string().min(1, "Category name is required"),
    status: z.enum(["active", "inactive"]).optional(),
  }),
});

export type ExploreCategoriesInput = z.infer<typeof exploreCategoriesSchema>["body"];
