export class ApiAppError extends Error {
  statusCode: number;
  details?: unknown;
  code?: string;

  constructor(statusCode: number, message: string, details?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}
