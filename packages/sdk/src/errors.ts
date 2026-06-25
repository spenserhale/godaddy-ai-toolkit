export class GoDaddyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly fields?: unknown
  ) {
    super(message);
    this.name = "GoDaddyError";
  }
}

export class GoDaddyAuthError extends GoDaddyError {
  constructor(message = "Authentication failed. Check GODADDY_API_KEY and GODADDY_API_SECRET.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "GoDaddyAuthError";
  }
}

export class GoDaddyNotFoundError extends GoDaddyError {
  constructor(message = "Resource not found.") {
    super(message, "NOT_FOUND", 404);
    this.name = "GoDaddyNotFoundError";
  }
}

export class GoDaddyValidationError extends GoDaddyError {
  constructor(message = "Request validation failed.", fields?: unknown) {
    super(message, "VALIDATION_ERROR", 422, fields);
    this.name = "GoDaddyValidationError";
  }
}

export class GoDaddyRateLimitError extends GoDaddyError {
  constructor(
    message = "Rate limit exceeded. Retry after the indicated delay.",
    public readonly retryAfter?: number
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "GoDaddyRateLimitError";
  }
}
