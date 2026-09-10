import { z } from "zod";

export const testimonialsCarouselSchema = z.object({
  body: z.object({
    testimonials: z.any().optional(),
  }),
});

export type TestimonialsCarouselInput = z.infer<typeof testimonialsCarouselSchema>["body"];
