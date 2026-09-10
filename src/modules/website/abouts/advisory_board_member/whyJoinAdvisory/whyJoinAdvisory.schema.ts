import { z } from "zod";

export const whyJoinAdvisorySchema = z.object({
  body: z.object({
    topSection: z.object({
      tagline: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
    bottomSection: z.object({
      tagline: z.string().optional(),
      titlePart1: z.string().optional(),
      titlePart2: z.string().optional(),
      description: z.string().optional(),
      features: z.array(z.object({
        iconPath: z.string().optional(),
        isSvgRaw: z.boolean().optional(),
        titlePart1: z.string().optional(),
        titlePart2: z.string().optional(),
        icon: z.string().optional(),
      })).optional(),
      buttonText: z.string().optional(),
      buttonLink: z.string().optional(),
    }).optional(),
    benefits: z.array(z.object({
      icon: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
      bgLight: z.string().optional(),
      borderColor: z.string().optional(),
      borderBottom: z.string().optional(),
      hoverShadow: z.string().optional(),
      hoverBg: z.string().optional(),
    })).optional(),
  }),
});

export type WhyJoinAdvisoryInput = z.infer<typeof whyJoinAdvisorySchema>["body"];
