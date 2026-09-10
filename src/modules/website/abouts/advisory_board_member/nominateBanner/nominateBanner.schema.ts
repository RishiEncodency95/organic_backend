import { z } from "zod";

export const nominateBannerSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    titlePart1: z.string().optional(),
    titlePart2: z.string().optional(),
    description: z.string().optional(),
    features: z.array(z.object({
      icon: z.string().optional(),
      titlePart1: z.string().optional(),
      titlePart2: z.string().optional(),
    })).optional(),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
  }),
});

export type NominateBannerInput = z.infer<typeof nominateBannerSchema>["body"];
