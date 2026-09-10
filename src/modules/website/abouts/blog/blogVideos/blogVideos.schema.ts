import { z } from "zod";

export const blogVideosSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    actionText: z.string().optional(),
    videos: z.array(z.object({
      img: z.string().optional(),
      title: z.string().optional(),
      duration: z.string().optional(),
    })).optional(),
  }),
});

export type BlogVideosInput = z.infer<typeof blogVideosSchema>["body"];
