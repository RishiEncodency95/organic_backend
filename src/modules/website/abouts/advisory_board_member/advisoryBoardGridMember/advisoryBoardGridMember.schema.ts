import { z } from "zod";

export const advisoryBoardGridMemberSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    designation: z.string().optional(),
    organization: z.string().optional(),
    location: z.string().optional(),
  }),
});

export type AdvisoryBoardGridMemberInput = z.infer<typeof advisoryBoardGridMemberSchema>["body"];
