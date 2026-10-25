/**
 * Comprehensive error handling utilities for the Looking For Feed feature
 * 
 * Provides centralized error handling, logging, and user-friendly error messages
 * with retry mechanisms and graceful degradation strategies.
 */

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  AI_ERROR = 'AI_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

export interface ErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  originalError?: Error;
  context?: ErrorContext;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: Error) => boolean;
}

export class LookingForFeedError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly originalError?: Error;
  public readonly context?: ErrorContext;
  public readonly retryable: boolean;
  public retryCount: number;
  public readonly maxRetries: number;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'LookingForFeedError';
    this.type = details.type;
    this.severity = details.severity;
    this.userMessage = details.userMessage;
    this.originalError = details.originalError;
    this.context = details.context;
    this.retryable = details.retryable;
    this.retryCount = details.retryCount || 0;
    this.maxRetries = details.maxRetries || 3;
  }

  canRetry(): boolean {
    return this.retryable && this.retryCount < this.maxRetries;
  }

  incrementRetry(): void {
    this.retryCount++;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      severity: this.severity,
      message: this.message,
      userMessage: this.userMessage,
      retryable: this.retryable,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorDetails[] = [];
  private maxLogSize = 100;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and classify errors
   */
  handleError(error: Error | LookingForFeedError, context?: ErrorContext): LookingForFeedError {
    console.error('[ErrorHandler] Handling error:', error);

    // If it's already a LookingForFeedError, just log and return
    if (error instanceof LookingForFeedError) {
      this.logError(error);
      return error;
    }

    // Classify the error
    const errorDetails = this.classifyError(error, context);
    const lookingForFeedError = new LookingForFeedError(errorDetails);
    
    this.logError(lookingForFeedError);
    return lookingForFeedError;
  }

  /**
   * Classify unknown errors into specific types
   */
  private classifyError(error: Error, context?: ErrorContext): ErrorDetails {
    const errorMessage = error.message.toLowerCase();
    const timestamp = new Date();

    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('fetch') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')) {
      return {
        type: ErrorType.NETWORK_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: `Network error: ${error.message}`,
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
        originalError: error,
        context: { ...context, timestamp },
        retryable: true,
        maxRetries: 3,
      };
    }

    // API errors
    if (errorMessage.includes('api') || 
        errorMessage.includes('400') || 
        errorMessage.includes('401') || 
        errorMessage.includes('403') || 
        errorMessage.includes('404') || 
        errorMessage.includes('500')) {
      return {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.HIGH,
        message: `API error: ${error.message}`,
        userMessage: 'There was a problem with the server. Please try again in a moment.',
        originalError: error,
        context: { ...context, timestamp },
        retryable: !errorMessage.includes('401') && !errorMessage.includes('403'),
        maxRetries: 2,
      };
    }

    // AI processing errors
    if (errorMessage.includes('ai') || 
        errorMessage.includes('openrouter') || 
        errorMessage.includes('model') ||
        errorMessage.includes('query processing')) {
      return {
        type: ErrorType.AI_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: `AI processing error: ${error.message}`,
        userMessage: 'AI search is temporarily unavailable. Showing all results instead.',
        originalError: error,
        context: { ...context, timestamp },
        retryable: true,
        maxRetries: 2,
      };
    }

    // Cache errors
    if (errorMessage.includes('cache') || 
        errorMessage.includes('storage') ||
        errorMessage.includes('asyncstorage')) {
      return {
        type: ErrorType.CACHE_ERROR,
        severity: ErrorSeverity.LOW,
        message: `Cache error: ${error.message}`,
        userMessage: 'Some features may be slower than usual.',
        originalError: error,
        context: { ...context, timestamp },
        retryable: false,
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') ||
        errorMessage.includes('required')) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        message: `Validation error: ${error.message}`,
        userMessage: 'Please check your input and try again.',
        originalError: error,
        context: { ...context, timestamp },
        retryable: false,
      };
    }

    // Unknown errors
    return {
      type: ErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.HIGH,
      message: `Unknown error: ${error.message}`,
      userMessage: 'An unexpected error occurred. Please try again.',
      originalError: error,
      context: { ...context, timestamp },
      retryable: true,
      maxRetries: 1,
    };
  }

  /**
   * Log error for debugging and analytics
   */
  private logError(error: LookingForFeedError): void {
    const errorDetails: ErrorDetails = {
      type: error.type,
      severity: error.severity,
      message: error.message,
      userMessage: error.userMessage,
      originalError: error.originalError,
      context: error.context,
      retryable: error.retryable,
      retryCount: error.retryCount,
      maxRetries: error.maxRetries,
    };

    // Add to error log
    this.errorLog.unshift(errorDetails);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Log to console with appropriate level
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[ErrorHandler] CRITICAL:', error.toJSON());
        break;
      case ErrorSeverity.HIGH:
        console.error('[ErrorHandler] HIGH:', error.toJSON());
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[ErrorHandler] MEDIUM:', error.toJSON());
        break;
      case ErrorSeverity.LOW:
        console.info('[ErrorHandler] LOW:', error.toJSON());
        break;
    }

    // In production, you might want to send this to an analytics service
    // this.sendToAnalytics(errorDetails);
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    context?: ErrorContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        if (attempt === options.maxRetries) {
          break; // Max retries reached
        }
        
        if (options.retryCondition && !options.retryCondition(lastError)) {
          break; // Retry condition not met
        }

        // Calculate delay
        const delay = options.exponentialBackoff 
          ? options.retryDelay * Math.pow(2, attempt)
          : options.retryDelay;

        console.warn(`[ErrorHandler] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed, handle the error
    throw this.handleError(lastError!, context);
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      retryableCount: 0,
      recentErrors: this.errorLog.slice(0, 10),
    };

    this.errorLog.forEach(error => {
      // Count by type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count retryable errors
      if (error.retryable) {
        stats.retryableCount++;
      }
    });

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    console.log('[ErrorHandler] Error log cleared');
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: Error | LookingForFeedError): string {
    if (error instanceof LookingForFeedError) {
      return error.userMessage;
    }

    const classifiedError = this.classifyError(error);
    return classifiedError.userMessage;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions
export const handleError = (error: Error, context?: ErrorContext) => 
  errorHandler.handleError(error, context);

export const withRetry = <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  context?: ErrorContext
) => errorHandler.withRetry(fn, options, context);

export const getUserMessage = (error: Error | LookingForFeedError) => 
  errorHandler.getUserMessage(error);