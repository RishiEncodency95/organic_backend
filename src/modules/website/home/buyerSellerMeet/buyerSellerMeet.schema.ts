import { z } from "zod";

export const buyerSellerMeetSchema = z.object({
  body: z.object({
    leftSection: z.any().optional(),
    rightSection: z.any().optional(),
    statsBar: z.any().optional(),
    premiumBand: z.any().optional(),
  }),
});

export type BuyerSellerMeetInput = z.infer<typeof buyerSellerMeetSchema>["body"];
