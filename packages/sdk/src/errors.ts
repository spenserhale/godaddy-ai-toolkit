export class GodaddyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "GodaddyError";
  }
}

export class GodaddyAuthError extends GodaddyError {
  constructor(message = "Authentication failed. Check your API key.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "GodaddyAuthError";
  }
}

export class GodaddyNotFoundError extends GodaddyError {
  constructor(resource: string, id: string) {
    super(`${resource} with id "${id}" not found`, "NOT_FOUND", 404);
    this.name = "GodaddyNotFoundError";
  }
}
