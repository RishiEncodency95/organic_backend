import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, "Email or staff ID is required"),
    password: z.string().min(1, "Password is required"),
    totpCode: z.string().optional(),
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

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("Valid email is required"),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type Verify2FAInput = z.infer<typeof verify2FASchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
