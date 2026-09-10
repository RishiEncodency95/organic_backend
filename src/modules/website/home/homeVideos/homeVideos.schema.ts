import { z } from "zod";

export const homeVideosSchema = z.object({
  body: z.object({
    videos: z.any().optional(),
  }),
});

export type HomeVideosInput = z.infer<typeof homeVideosSchema>["body"];
