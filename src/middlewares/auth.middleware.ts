import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { getCache, CACHE_KEYS } from "../config/redis";

// JWT payload type
export interface JwtPayload {
  id: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Extended req.user definition in src/types/express.d.ts
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Access token missing");
    }

    const token = authHeader.split(" ")[1];

    // Check if token is blacklisted (invalidated on logout)
    const isBlacklisted = await getCache(`blacklist:${token}`);
    if (isBlacklisted) {
      throw ApiError.unauthorized("Token has been invalidated");
    }

    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized("Access token expired"));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized("Invalid access token"));
    } else {
      next(error);
    }
  }
};

// Role-based access control
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(ApiError.forbidden("You don't have permission"));
      return;
    }

    next();
  };
};
