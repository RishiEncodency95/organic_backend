import { z } from "zod";

export const visionMissionSchema = z.object({
  body: z.object({
    vision: z.any().optional(),
    mission: z.any().optional(),
    status: z.string().optional(),
  }),
});

export type VisionMissionInput = z.infer<typeof visionMissionSchema>["body"];
