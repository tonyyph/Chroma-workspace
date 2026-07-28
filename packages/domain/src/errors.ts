export type DomainErrorCode =
  | 'INVALID_IMAGE'
  | 'PALETTE_EXTRACTION_FAILED'
  | 'MEMORY_NOT_FOUND'
  | 'PERSISTED_DATA_INVALID'
  | 'ENTITLEMENT_LIMIT_REACHED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DomainError';
    this.code = code;
  }
}
