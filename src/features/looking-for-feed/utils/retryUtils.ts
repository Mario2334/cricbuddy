/**
 * Retry utilities with exponential backoff for API requests
 * 
 * Implements retry mechanism for rate limits and temporary failures
 * with configurable maximum retry attempts and backoff intervals.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalDelay: number;
}

export class RetryManager {
  private readonly config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableStatusCodes: [429, 500, 502, 503, 504],
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNRESET', 'ENOTFOUND'],
      ...config,
    };
  }

  /**
   * Execute a function with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<RetryResult<T>> {
    let lastError: Error | null = null;
    let totalDelay = 0;
    let actualAttempts = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      actualAttempts = attempt + 1;
      try {
        console.log(`[RetryManager] Executing ${operationName}, attempt ${attempt + 1}/${this.config.maxRetries + 1}`);
        
        const result = await operation();
        
        if (attempt > 0) {
          console.log(`[RetryManager] ${operationName} succeeded after ${attempt} retries`);
        }
        
        return {
          success: true,
          data: result,
          attempts: actualAttempts,
          totalDelay,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(`[RetryManager] ${operationName} failed on attempt ${attempt + 1}:`, lastError.message);
        
        // Check if this is the last attempt
        if (attempt === this.config.maxRetries) {
          console.error(`[RetryManager] ${operationName} failed after ${attempt + 1} attempts`);
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          console.log(`[RetryManager] ${operationName} failed with non-retryable error:`, lastError.message);
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        totalDelay += delay;
        
        console.log(`[RetryManager] Retrying ${operationName} in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts: actualAttempts,
      totalDelay,
    };
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private isRetryableError(error: Error): boolean {
    // Check for HTTP status codes (if error has status property)
    const httpError = error as any;
    if (httpError.status && this.config.retryableStatusCodes.includes(httpError.status)) {
      return true;
    }

    // Check for specific error messages/codes
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toLowerCase() || '';
    
    return this.config.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) || 
      errorCode.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    
    // Add jitter (±25% randomization) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;
    
    // Cap at maximum delay
    return Math.min(delayWithJitter, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

/**
 * Default retry manager instance for API requests
 */
export const defaultRetryManager = new RetryManager({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNRESET', 'ENOTFOUND', 'fetch'],
});

/**
 * Retry manager specifically configured for rate limiting scenarios
 */
export const rateLimitRetryManager = new RetryManager({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  retryableStatusCodes: [429], // Only retry rate limits
  retryableErrors: ['rate limit', 'too many requests'],
});