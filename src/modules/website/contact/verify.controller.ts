import { Request, Response } from "express";
import asyncHandler from "../../../utils/asyncHandler";
import {
  sendPhoneOtpService,
  verifyPhoneOtpService,
  sendEmailOtpService,
  verifyEmailOtpService,
} from "./verify.service";

export const sendPhoneOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, profile, name, eventName } = req.body;
  if (!phone) {
    res.status(400).json({
      success: false,
      message: "Phone number is required",
      msg: "Phone number is required",
    });
    return;
  }

  const result = await sendPhoneOtpService(phone, profile, name, eventName);
  res.status(200).json(result);
});

export const verifyPhoneOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400).json({
      success: false,
      message: "Phone number and OTP are required",
      msg: "Phone number and OTP are required",
    });
    return;
  }

  const result = await verifyPhoneOtpService(phone, otp);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
});

export const sendEmailOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, profile, name, eventName } = req.body;
  if (!email) {
    res.status(400).json({
      success: false,
      message: "Email address is required",
      msg: "Email address is required",
    });
    return;
  }

  const result = await sendEmailOtpService(email, profile, name, eventName);
  res.status(200).json(result);
});

export const verifyEmailOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    res.status(400).json({
      success: false,
      message: "Email address and OTP are required",
      msg: "Email address and OTP are required",
    });
    return;
  }

  const result = await verifyEmailOtpService(email, otp);
  const statusCode = result.success ? 200 : 400;
  res.status(statusCode).json(result);
});
