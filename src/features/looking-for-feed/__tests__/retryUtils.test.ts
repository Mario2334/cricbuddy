/**
 * Tests for retry utilities
 */

import { RetryManager } from '../utils/retryUtils';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNRESET', 'ENOTFOUND'],
    });
  });

  it('should succeed on first attempt', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success');
    
    const result = await retryManager.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const networkError = new Error('NETWORK_ERROR') as any;
    networkError.code = 'NETWORK_ERROR';
    
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue('success');
    
    const result = await retryManager.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
    expect(mockOperation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors', async () => {
    const nonRetryableError = new Error('Invalid request format');
    const mockOperation = jest.fn().mockRejectedValue(nonRetryableError);
    
    // Add spy to check if isRetryableError is called correctly
    const isRetryableSpy = jest.spyOn(retryManager as any, 'isRetryableError');
    
    const result = await retryManager.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid request format');
    expect(result.attempts).toBe(1);
    expect(mockOperation).toHaveBeenCalledTimes(1);
    expect(isRetryableSpy).toHaveBeenCalledWith(nonRetryableError);
    expect(isRetryableSpy).toHaveReturnedWith(false);
  });

  it('should fail after max retries', async () => {
    const retryableError = new Error('TIMEOUT') as any;
    retryableError.code = 'TIMEOUT';
    
    const mockOperation = jest.fn().mockRejectedValue(retryableError);
    
    const result = await retryManager.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('TIMEOUT');
    expect(result.attempts).toBe(3); // maxRetries + 1
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  it('should retry on HTTP status codes', async () => {
    const httpError = new Error('Rate limit exceeded') as any;
    httpError.status = 429;
    
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(httpError)
      .mockResolvedValue('success');
    
    const result = await retryManager.executeWithRetry(mockOperation, 'test-operation');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(2);
    expect(mockOperation).toHaveBeenCalledTimes(2);
  });
});