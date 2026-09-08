import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // ApiError — known/expected errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // MongoDB duplicate key error
  if ((err as NodeJS.ErrnoException).name === "MongoServerError") {
    res.status(409).json({
      success: false,
      statusCode: 409,
      message: "Duplicate entry — data already exists",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unknown server errors
  res.status(500).json({
    success: false,
    statusCode: 500,
    message: "Internal Server Error",
    ...(env.NODE_ENV === "development" && {
      stack: err.stack,
      detail: err.message,
    }),
    timestamp: new Date().toISOString(),
  });
};
