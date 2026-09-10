import { z } from "zod";

export const sponsorsAndAttendSchema = z.object({
  body: z.object({
    leftSection: z.any().optional(),
    centerSection: z.any().optional(),
    rightSection: z.any().optional(),
  }),
});

export type SponsorsAndAttendInput = z.infer<typeof sponsorsAndAttendSchema>["body"];
