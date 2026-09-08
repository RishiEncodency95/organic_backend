import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

// Validate incoming requests against a Zod schema
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = (error.issues || []).map(
          (e: any) => `${e.path.slice(1).join(".")}: ${e.message}`
        );
        next(ApiError.badRequest("Validation failed", issues));
      } else {
        next(error);
      }
    }
  };
};
