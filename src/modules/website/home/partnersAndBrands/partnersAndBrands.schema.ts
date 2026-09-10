import { z } from "zod";

export const partnersAndBrandsSchema = z.object({
  body: z.object({
    industryLeadersLogos: z.any().optional(),
    knowledgeLogos: z.any().optional(),
    wellnessLogos: z.any().optional(),
    supportingLogos: z.any().optional(),
    emergingBrandsLogos: z.any().optional(),
  }),
});

export type PartnersAndBrandsInput = z.infer<typeof partnersAndBrandsSchema>["body"];
