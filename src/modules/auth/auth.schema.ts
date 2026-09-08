import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email or staff ID is required"),
    password: z.string().min(1, "Password is required"),
  }),
});

export const verify2FASchema = z.object({
  body: z.object({
    token: z
      .string()
      .length(6, "Token must be exactly 6 digits")
      .regex(/^\d+$/, "Token must contain only digits"),
    tempToken: z.string().optional(),
  }),
});

export const setup2FASchema = z.object({
  body: z.object({
    token: z
      .string()
      .length(6, "Token must be 6 digits")
      .regex(/^\d+$/, "Token must be digits only"),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type Verify2FAInput = z.infer<typeof verify2FASchema>["body"];
