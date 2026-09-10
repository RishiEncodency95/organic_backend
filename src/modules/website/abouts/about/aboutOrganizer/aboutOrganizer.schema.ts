import { z } from "zod";

export const aboutOrganizerSchema = z.object({
  body: z.object({
    about: z.any().optional(),
    badge: z.any().optional(),
    journey: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type AboutOrganizerInput = z.infer<typeof aboutOrganizerSchema>["body"];
