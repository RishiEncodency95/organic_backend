import { z } from "zod";

export const globalPlatformSchema = z.object({
  body: z.object({
    badge: z.string().optional(),
    title: z.any().optional(),
    description: z.string().optional(),
    listItems: z.any().optional(),
    cards: z.any().optional(),
  }),
});

export type GlobalPlatformInput = z.infer<typeof globalPlatformSchema>["body"];
