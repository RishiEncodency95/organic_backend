import { z } from "zod";

export const sponsorshipCategoriesSchema = z.object({
  body: z.object({
    headerTitle: z.string().optional(),
    categories: z.any().optional(),
    promoBox: z.any().optional(),
    form: z.any().optional(),
  }),
});

export type SponsorshipCategoriesInput = z.infer<typeof sponsorshipCategoriesSchema>["body"];
