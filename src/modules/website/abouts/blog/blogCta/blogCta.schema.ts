import { z } from "zod";

export const blogCtaSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    buttons: z.array(z.object({
      text: z.string().optional(),
      link: z.string().optional(),
      styleClass: z.string().optional(),
    })).optional(),
    info: z.array(z.object({
      icon: z.string().optional(),
      text: z.string().optional(),
    })).optional(),
  }),
});

export type BlogCtaInput = z.infer<typeof blogCtaSchema>["body"];
