/**
 * OpenRouter API Client for Looking For Feed
 * 
 * This client handles AI API communication with OpenRouter for natural language processing
 * with proper authentication, model fallback, request formatting, and retry mechanisms.
 */

import { AIQuery, PostFilters, OpenRouterConfig, ModelConfig } from '../types';
import { defaultRetryManager, RetryResult } from '../utils/retryUtils';

// OpenRouter API interfaces
export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface OpenRouterChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

export interface OpenRouterApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  modelUsed?: string;
  fallbackAttempts?: number;
}

export class OpenRouterApiClient {
  private readonly config: OpenRouterConfig;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config?: Partial<OpenRouterConfig>) {
    // Default configuration with model fallback priority
    this.config = {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: [
        {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          priority: 1,
          maxRetries: 2,
        },
        {
          id: 'qwen/qwen-2.5-72b-instruct',
          name: 'Qwen 2.5 72B',
          priority: 2,
          maxRetries: 2,
        },
        {
          id: 'meta-llama/llama-3.1-8b-instruct:free',
          name: 'Llama 3.1 8B',
          priority: 3,
          maxRetries: 2,
        },
      ],
      ...config,
    };

    this.defaultHeaders = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://cricheroes.com',
      'X-Title': 'CricBuddy Looking For Feed',
    };
  }

  /**
   * Process natural language query with model fallback
   */
  async processQuery(rawQuery: string): Promise<OpenRouterApiResponse<AIQuery>> {
    if (!rawQuery || rawQuery.trim().length === 0) {
      return {
        success: false,
        error: 'Query cannot be empty',
      };
    }

    // Sort models by priority
    const sortedModels = [...this.config.models].sort((a, b) => a.priority - b.priority);
    
    let lastError: string = '';
    let totalFallbackAttempts = 0;

    // Try each model in priority order
    for (const model of sortedModels) {
      console.log(`[OpenRouterApiClient] Attempting query processing with model: ${model.name}`);
      
      const result = await this.tryModelWithRetry(model, rawQuery);
      
      if (result.success && result.data) {
        console.log(`[OpenRouterApiClient] Successfully processed query with model: ${model.name}`);
        return {
          success: true,
          data: {
            ...result.data,
            modelUsed: model.name,
            fallbackAttempts: totalFallbackAttempts,
          },
          modelUsed: model.name,
          fallbackAttempts: totalFallbackAttempts,
        };
      }
      
      lastError = result.error || 'Unknown error';
      totalFallbackAttempts++;
      
      console.warn(`[OpenRouterApiClient] Model ${model.name} failed: ${lastError}`);
    }

    // All models failed
    console.error(`[OpenRouterApiClient] All models failed after ${totalFallbackAttempts} attempts`);
    return {
      success: false,
      error: `All AI models failed. Last error: ${lastError}`,
      fallbackAttempts: totalFallbackAttempts,
    };
  }

  /**
   * Try a specific model with retry logic
   */
  private async tryModelWithRetry(
    model: ModelConfig,
    rawQuery: string
  ): Promise<OpenRouterApiResponse<AIQuery>> {
    const retryResult = await defaultRetryManager.executeWithRetry(
      async () => {
        return await this.makeRequest(model.id, rawQuery);
      },
      `OpenRouter ${model.name} query processing`
    );

    if (retryResult.success && retryResult.data) {
      return {
        success: true,
        data: retryResult.data,
      };
    } else {
      return {
        success: false,
        error: retryResult.error || 'Request failed after retries',
      };
    }
  }

  /**
   * Make HTTP request to OpenRouter API
   */
  private async makeRequest(modelId: string, rawQuery: string): Promise<AIQuery> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const requestBody: OpenRouterRequest = {
      model: modelId,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: rawQuery,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      top_p: 0.9,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for rate limiting
      if (response.status === 429) {
        const rateLimitError = new Error('Rate limit exceeded') as any;
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      // Check for authentication errors
      if (response.status === 401) {
        const authError = new Error('Authentication failed - invalid API key') as any;
        authError.status = 401;
        throw authError;
      }

      // Check for other HTTP errors
      if (!response.ok) {
        const httpError = new Error(`HTTP error! status: ${response.status}`) as any;
        httpError.status = response.status;
        throw httpError;
      }

      const data: OpenRouterResponse = await response.json();

      // Check for API-level errors
      if (data.error) {
        const apiError = new Error(`OpenRouter API error: ${data.error.message}`) as any;
        apiError.code = data.error.code;
        throw apiError;
      }

      // Parse the AI response
      return this.parseAIResponse(rawQuery, data);
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const timeoutError = new Error('Request timeout') as any;
          timeoutError.code = 'TIMEOUT';
          throw timeoutError;
        }
        
        // Network errors
        if (error.message.includes('fetch')) {
          const networkError = new Error('Network error') as any;
          networkError.code = 'NETWORK_ERROR';
          throw networkError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get system prompt for cricket recruitment post filtering
   */
  private getSystemPrompt(): string {
    return `You are an AI assistant that helps filter cricket recruitment posts based on natural language queries.

Your task is to analyze user queries and extract filtering criteria for cricket posts. Return your response as a JSON object with the following structure:

{
  "filters": {
    "positions": ["batsman", "bowler", "wicket-keeper", "all-rounder"] // optional array
    "dates": {
      "startDate": "YYYY-MM-DD", // optional
      "endDate": "YYYY-MM-DD"    // optional
    },
    "times": {
      "startTime": "HH:MM", // optional, 24-hour format
      "endTime": "HH:MM"    // optional, 24-hour format
    },
    "locations": ["city1", "city2"], // optional array
    "skillLevels": ["beginner", "intermediate", "advanced", "professional"] // optional array
  },
  "confidence": 0.85, // number between 0 and 1
  "suggestions": ["Try: 'Find batsman needed tomorrow morning'", "Try: 'Looking for weekend matches'"] // optional array
}

Guidelines:
- Extract specific positions mentioned (batsman, bowler, wicket-keeper, all-rounder)
- Parse dates from natural language (today, tomorrow, Saturday, 31st, etc.)
- Convert time references to 24-hour format (morning = 06:00-12:00, evening = 18:00-22:00)
- Identify location mentions (city names, areas)
- Determine skill level if mentioned
- Set confidence based on query clarity (0.9+ for specific queries, 0.5-0.8 for vague ones)
- Provide helpful suggestions for unclear queries
- If query is too vague, return empty filters with low confidence and suggestions

Examples:
- "Find batsman needed tomorrow morning" → positions: ["batsman"], dates: {startDate: "tomorrow"}, times: {startTime: "06:00", endTime: "12:00"}
- "Looking for weekend matches" → dates: {startDate: "next Saturday", endDate: "next Sunday"}
- "Need wicket keeper for evening game" → positions: ["wicket-keeper"], times: {startTime: "18:00", endTime: "22:00"}

Always respond with valid JSON only, no additional text.`;
  }

  /**
   * Parse AI response and convert to AIQuery format
   */
  private parseAIResponse(rawQuery: string, response: OpenRouterResponse): AIQuery {
    try {
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in AI response');
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty content in AI response');
      }

      // Parse JSON response
      const parsed = JSON.parse(content);
      
      if (!parsed.filters) {
        throw new Error('Missing filters in AI response');
      }

      // Convert parsed response to our domain types
      const processedFilters: PostFilters = {
        positions: parsed.filters.positions || undefined,
        dates: parsed.filters.dates ? {
          startDate: this.parseDate(parsed.filters.dates.startDate),
          endDate: this.parseDate(parsed.filters.dates.endDate),
        } : undefined,
        times: parsed.filters.times ? {
          startTime: parsed.filters.times.startTime,
          endTime: parsed.filters.times.endTime,
        } : undefined,
        locations: parsed.filters.locations || undefined,
        skillLevels: parsed.filters.skillLevels || undefined,
      };

      return {
        rawQuery,
        processedFilters,
        confidence: parsed.confidence || 0.5,
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      console.error('[OpenRouterApiClient] Failed to parse AI response:', error, { response });
      
      // Return fallback response with low confidence
      return {
        rawQuery,
        processedFilters: {},
        confidence: 0.1,
        suggestions: [
          'Try being more specific about position needed',
          'Include date and time preferences',
          'Mention your location or preferred area',
        ],
      };
    }
  }

  /**
   * Parse date string to Date object with natural language support
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date();
    }

    // Handle relative dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    switch (dateStr.toLowerCase()) {
      case 'today':
        return today;
      case 'tomorrow':
        return tomorrow;
      case 'next saturday':
        const nextSaturday = new Date(today);
        nextSaturday.setDate(today.getDate() + (6 - today.getDay() + 7) % 7);
        return nextSaturday;
      case 'next sunday':
        const nextSunday = new Date(today);
        nextSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
        return nextSunday;
      default:
        // Try to parse as ISO date or fallback to Date constructor
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? today : parsed;
    }
  }

  /**
   * Validate API configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiKey) {
      errors.push('OpenRouter API key is required');
    }

    if (!this.config.baseUrl) {
      errors.push('OpenRouter base URL is required');
    }

    if (!this.config.models || this.config.models.length === 0) {
      errors.push('At least one model configuration is required');
    }

    // Validate model configurations
    this.config.models.forEach((model, index) => {
      if (!model.id) {
        errors.push(`Model ${index + 1}: ID is required`);
      }
      if (!model.name) {
        errors.push(`Model ${index + 1}: Name is required`);
      }
      if (typeof model.priority !== 'number' || model.priority < 1) {
        errors.push(`Model ${index + 1}: Priority must be a positive number`);
      }
      if (typeof model.maxRetries !== 'number' || model.maxRetries < 0) {
        errors.push(`Model ${index + 1}: Max retries must be a non-negative number`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenRouterConfig {
    return { ...this.config };
  }

  /**
   * Test API connectivity with a simple query
   */
  async testConnection(): Promise<OpenRouterApiResponse<boolean>> {
    try {
      const result = await this.processQuery('test connection');
      return {
        success: result.success,
        data: result.success,
        error: result.error,
        modelUsed: result.modelUsed,
        fallbackAttempts: result.fallbackAttempts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: false,
      };
    }
  }
}

export default new OpenRouterApiClient();