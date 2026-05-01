import { describe, it, expect } from '@jest/globals';
import { calculateDelay, withRetry, getErrorType, sleep } from '../../src/utils/retry.js';

describe('Retry Utils', () => {
  describe('calculateDelay', () => {
    it('should calculate fixed delay', () => {
      expect(calculateDelay(1, { backoff: 'fixed', initialDelay: 1000 })).toBe(1000);
      expect(calculateDelay(3, { backoff: 'fixed', initialDelay: 1000 })).toBe(1000);
    });

    it('should calculate linear delay', () => {
      expect(calculateDelay(1, { backoff: 'linear', initialDelay: 1000 })).toBe(1000);
      expect(calculateDelay(2, { backoff: 'linear', initialDelay: 1000 })).toBe(2000);
      expect(calculateDelay(3, { backoff: 'linear', initialDelay: 1000 })).toBe(3000);
    });

    it('should calculate exponential delay', () => {
      expect(calculateDelay(1, { backoff: 'exponential', initialDelay: 1000 })).toBe(1000);
      expect(calculateDelay(2, { backoff: 'exponential', initialDelay: 1000 })).toBe(2000);
      expect(calculateDelay(3, { backoff: 'exponential', initialDelay: 1000 })).toBe(4000);
    });

    it('should respect maxDelay', () => {
      expect(calculateDelay(10, { backoff: 'exponential', initialDelay: 1000, maxDelay: 5000 })).toBe(5000);
    });
  });

  describe('getErrorType', () => {
    it('should detect rate limit errors', () => {
      expect(getErrorType(new Error('Rate limit exceeded'))).toBe('rate_limit');
      expect(getErrorType(new Error('Error: 429 Too Many Requests'))).toBe('rate_limit');
    });

    it('should detect timeout errors', () => {
      expect(getErrorType(new Error('Request timeout'))).toBe('timeout');
    });

    it('should detect server errors', () => {
      expect(getErrorType(new Error('500 Internal Server Error'))).toBe('server_error');
      expect(getErrorType(new Error('503 Service Unavailable'))).toBe('server_error');
    });

    it('should detect API key errors', () => {
      expect(getErrorType(new Error('Invalid API key'))).toBe('invalid_api_key');
      expect(getErrorType(new Error('401 Unauthorized'))).toBe('invalid_api_key');
    });

    it('should detect network errors', () => {
      expect(getErrorType(new Error('ECONNREFUSED'))).toBe('network_error');
    });

    it('should default to execution_error', () => {
      expect(getErrorType(new Error('Some random error'))).toBe('execution_error');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        return 'success';
      };
      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(calls).toBe(1);
    });

    it('should retry on retriable errors', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls === 1) throw new Error('Rate limit');
        return 'success';
      };

      const result = await withRetry(fn, { maxAttempts: 3, initialDelay: 10 });

      expect(result).toBe('success');
      expect(calls).toBe(2);
    });

    it('should fail after max attempts', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw new Error('Rate limit');
      };

      await expect(withRetry(fn, { maxAttempts: 2, initialDelay: 10 }))
        .rejects.toThrow('Rate limit');

      expect(calls).toBe(2);
    });

    it('should not retry non-retriable errors', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        throw new Error('Invalid API key');
      };

      await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 10 }))
        .rejects.toThrow('Invalid API key');

      expect(calls).toBe(1);
    });

    it('should call onError callback', async () => {
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls === 1) throw new Error('Rate limit');
        return 'success';
      };

      const errors: Array<{ attempt: number }> = [];
      await withRetry(fn, { maxAttempts: 3, initialDelay: 10 }, (ctx) => {
        errors.push({ attempt: ctx.attempt });
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]?.attempt).toBe(1);
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(50);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });
});
