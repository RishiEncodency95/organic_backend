import { z } from "zod";

export const advisoryPartnerSchema = z.object({
  body: z.object({
    partners: z.array(z.object({
      tagline: z.string().optional(),
      image: z.string().optional(),
      alt: z.string().optional(),
      isImage: z.boolean().optional(),
      text: z.string().optional(),
    })).optional(),
  }),
});

export type AdvisoryPartnerInput = z.infer<typeof advisoryPartnerSchema>["body"];
