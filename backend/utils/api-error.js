export class ApiError extends Error {
  constructor(status, message, code = "REQUEST_FAILED", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const assertDb = (result, message = "Database operation failed") => {
  if (result.error) throw new ApiError(500, message, "DATABASE_ERROR");
  return result.data;
};
