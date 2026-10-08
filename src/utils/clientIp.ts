import { Request } from "express";

/** The visitor's IP (behind the proxy thanks to `trust proxy`), with IPv6 localhost / mapped forms tidied. */
export const clientIp = (req: Request) => {
  const ip = (req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return ip === "::1" ? "127.0.0.1" : ip;
};
