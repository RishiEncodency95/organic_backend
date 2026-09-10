import { z } from "zod";

export const advisoryBoardGridSchema = z.object({
  body: z.object({
    tagline: z.string().optional(),
    title: z.string().optional(),
  }),
});

export type AdvisoryBoardGridInput = z.infer<typeof advisoryBoardGridSchema>["body"];
