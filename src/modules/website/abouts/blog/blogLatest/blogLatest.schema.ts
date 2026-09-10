import { z } from "zod";

export const blogLatestSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    actionText: z.string().optional(),
    updates: z.array(z.object({
      tag: z.string().optional(),
      img: z.string().optional(),
      title: z.string().optional(),
      desc: z.string().optional(),
      date: z.string().optional(),
      read: z.string().optional(),
      link: z.string().optional(),
    })).optional(),
  }),
});

export type BlogLatestInput = z.infer<typeof blogLatestSchema>["body"];
