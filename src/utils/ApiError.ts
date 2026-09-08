// Custom API Error class for operational errors
export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors: string[];

  constructor(
    statusCode: number,
    message: string,
    errors: string[] = [],
    stack?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Expected errors (not bugs)
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Common error helpers
  static badRequest(message: string, errors: string[] = []): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message: string = "Not Found"): ApiError {
    return new ApiError(404, message);
  }

  static tooManyRequests(message: string = "Too many requests"): ApiError {
    return new ApiError(429, message);
  }

  static internal(message: string = "Internal Server Error"): ApiError {
    return new ApiError(500, message);
  }
}
