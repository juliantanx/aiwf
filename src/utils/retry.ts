import type { RetryConfig } from '../core/types.js';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  retryOn: ['rate_limit', 'timeout', 'server_error'],
};

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateDelay(
  attempt: number,
  config: Partial<RetryConfig>
): number {
  const { backoff = 'exponential', initialDelay = 1000, maxDelay = 30000 } = config;

  let delay: number;

  switch (backoff) {
    case 'fixed':
      delay = initialDelay;
      break;
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'exponential':
    default:
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;
  }

  return Math.min(delay, maxDelay);
}

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  error: Error;
  delay: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onError?: (ctx: RetryContext) => void | Promise<void>
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { maxAttempts, retryOn } = fullConfig;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const errorType = getErrorType(lastError);
      const shouldRetry = retryOn.includes(errorType) || retryOn.includes('*');

      if (!shouldRetry || attempt >= maxAttempts) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, fullConfig);

      if (onError) {
        await onError({
          attempt,
          maxAttempts,
          error: lastError,
          delay,
        });
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

export function getErrorType(error: Error): string {
  const message = error.message.toLowerCase();
  const name = error.constructor.name.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return 'rate_limit';
  }
  if (message.includes('timeout') || name.includes('timeout')) {
    return 'timeout';
  }
  if (message.includes('server error') || message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'server_error';
  }
  if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
    return 'invalid_api_key';
  }
  if (message.includes('not found') || message.includes('404')) {
    return 'model_not_found';
  }
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return 'network_error';
  }

  return 'execution_error';
}
