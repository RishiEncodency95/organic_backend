// Standard API response format — consistent across all APIs
export class ApiResponse<T = unknown> {
  public success: boolean;
  public statusCode: number;
  public message: string;
  public data: T | null;
  public timestamp: string;

  constructor(statusCode: number, message: string, data: T | null = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  // Helper methods
  static ok<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(200, message, data);
  }

  static created<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(201, message, data);
  }

  static noContent(message: string): ApiResponse<null> {
    return new ApiResponse(204, message, null);
  }
}
