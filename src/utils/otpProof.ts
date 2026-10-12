import { env } from "../config/env";

/*
 * Forms verify emails / mobiles by OTP in the browser, and the server can confirm a verified
 * OTP record exists as proof. That only works when the OTPs were verified by THIS backend.
 * The live website sends and verifies OTPs on the IHWE server (NEXT_PUBLIC_IHWE_API_URL /
 * NEXT_PUBLIC_OTP_API_URL), whose records are not in this database — so the proof check is on
 * only when OTP_VERIFIED_BY_THIS_SERVER=true. Outside production the dev master OTP (123456)
 * verifies without a stored record, so it is always off there.
 */
export const otpProofRequired = () =>
  env.NODE_ENV === "production" && process.env.OTP_VERIFIED_BY_THIS_SERVER === "true";
