import { z } from "zod";

export const eventOverviewSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    title: z.string().optional(),
    paragraphs: z.any().optional(),
    sectorsTitle: z.string().optional(),
    sectors: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type EventOverviewInput = z.infer<typeof eventOverviewSchema>["body"];
