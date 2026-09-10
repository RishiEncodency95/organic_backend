import { z } from "zod";

export const becomeSponsorSchema = z.object({
  body: z.object({
    leftSection: z.any().optional(),
    centerSection: z.any().optional(),
    rightSection: z.any().optional(),
  }),
});

export type BecomeSponsorInput = z.infer<typeof becomeSponsorSchema>["body"];
