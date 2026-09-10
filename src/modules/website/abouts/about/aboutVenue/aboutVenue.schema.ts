import { z } from "zod";

export const aboutVenueSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    title: z.string().optional(),
    hallBadge: z.string().optional(),
    locationBadge: z.string().optional(),
    imageAlt: z.string().optional(),
    features: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type AboutVenueInput = z.infer<typeof aboutVenueSchema>["body"];
