import { z } from "zod";

export const aboutStripSchema = z.object({
  body: z.object({
    items: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type AboutStripInput = z.infer<typeof aboutStripSchema>["body"];
