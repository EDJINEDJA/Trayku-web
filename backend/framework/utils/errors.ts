/** Error types, as Medusa's MedusaError: the HTTP layer maps each one to a status. */
export const ErrorTypes = {
  NOT_FOUND: 'not_found',
  INVALID_DATA: 'invalid_data',
  UNAUTHORIZED: 'unauthorized',
  NOT_ALLOWED: 'not_allowed',
  CONFLICT: 'conflict',
  DUPLICATE_ERROR: 'duplicate_error',
  UNEXPECTED_STATE: 'unexpected_state',
  TOO_MANY_REQUESTS: 'too_many_requests',
} as const;

export type ErrorType = (typeof ErrorTypes)[keyof typeof ErrorTypes];

export class TraikuError extends Error {
  static Types = ErrorTypes;
  readonly type: ErrorType;
  /** A short code the clients can switch on ("code_invalid", "mission_taken"…). */
  readonly code?: string;

  constructor(type: ErrorType, message: string, code?: string) {
    super(message);
    this.name = 'TraikuError';
    this.type = type;
    this.code = code;
  }
}

export const isTraikuError = (e: unknown): e is TraikuError => e instanceof TraikuError;
