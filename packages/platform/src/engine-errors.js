export class EngineError extends Error {
  constructor(code, safeMessage, options = {}) {
    super(safeMessage, options);
    this.name = 'EngineError';
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

export const engineError = {
  unavailable: (domain) => new EngineError('engine_unavailable', `${domain} service unavailable`),
  authentication: () => new EngineError('engine_authentication_failed', 'Engine authentication failed'),
  timeout: (domain) => new EngineError('engine_timeout', `${domain} service unavailable`),
  invalid: () => new EngineError('engine_response_invalid', 'Engine response was invalid'),
  validation: (message) => new EngineError('engine_validation_failed', message || 'The engine did not accept this setting')
};
