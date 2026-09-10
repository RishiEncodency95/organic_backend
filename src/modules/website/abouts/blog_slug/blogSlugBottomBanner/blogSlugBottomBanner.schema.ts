import { z } from "zod";

export const blogSlugBottomBannerSchema = z.object({
  body: z.object({
    banners: z.array(z.object({
      icon: z.string().optional(),
      label: z.string().optional(),
    })).optional(),
  }),
});

export type BlogSlugBottomBannerInput = z.infer<typeof blogSlugBottomBannerSchema>["body"];
