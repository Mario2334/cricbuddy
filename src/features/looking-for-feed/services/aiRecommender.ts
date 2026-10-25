/**
 * AI Recommender Service for Looking For Feed
 * 
 * This service handles AI-powered recommendation and filtering logic,
 * converting natural language queries into structured filters and applying
 * them to recruitment posts with confidence scoring and fallback handling.
 */

import { 
  AIQuery, 
  PostFilters, 
  RecruitmentPost, 
  SkillLevel,
  DateRange,
  TimeRange 
} from '../types';
import { OpenRouterApiClient, OpenRouterApiResponse } from './openRouterApiClient';
import { 
  applyAllFilters, 
  validateFilters, 
  getFilterStatistics,
  FilterStatistics,
  FilterValidationResult 
} from '../utils/filterUtils';

export interface FilterApplicationResult {
  filteredPosts: RecruitmentPost[];
  totalMatches: number;
  appliedFilters: PostFilters;
  confidence: number;
  suggestions?: string[];
  modelUsed?: string;
  fallbackAttempts?: number;
  statistics?: FilterStatistics;
  validation?: FilterValidationResult;
}

export interface AIRecommenderConfig {
  minConfidenceThreshold: number;
  maxSuggestions: number;
  enableFallback: boolean;
}

export class AIRecommender {
  private readonly openRouterClient: OpenRouterApiClient;
  private readonly config: AIRecommenderConfig;

  constructor(
    openRouterClient?: OpenRouterApiClient,
    config?: Partial<AIRecommenderConfig>
  ) {
    this.openRouterClient = openRouterClient || new OpenRouterApiClient();
    this.config = {
      minConfidenceThreshold: 0.3,
      maxSuggestions: 3,
      enableFallback: true,
      ...config,
    };
  }

  /**
   * Process natural language query and generate filters
   */
  async generateFilters(rawQuery: string): Promise<OpenRouterApiResponse<AIQuery>> {
    if (!rawQuery || rawQuery.trim().length === 0) {
      return {
        success: false,
        error: 'Query cannot be empty',
      };
    }

    try {
      console.log(`[AIRecommender] Processing query: "${rawQuery}"`);
      
      const result = await this.openRouterClient.processQuery(rawQuery);
      
      if (!result.success) {
        console.error('[AIRecommender] Failed to process query:', result.error);
        
        if (this.config.enableFallback) {
          return this.generateFallbackResponse(rawQuery, result.error);
        }
        
        return result;
      }

      if (!result.data) {
        console.error('[AIRecommender] No data in successful response');
        return {
          success: false,
          error: 'No data received from AI service',
        };
      }

      // Enhance the AI response with additional processing
      const enhancedQuery = this.enhanceAIQuery(result.data);
      
      console.log(`[AIRecommender] Successfully generated filters with confidence: ${enhancedQuery.confidence}`);
      
      return {
        success: true,
        data: enhancedQuery,
        modelUsed: result.modelUsed,
        fallbackAttempts: result.fallbackAttempts,
      };
    } catch (error) {
      console.error('[AIRecommender] Unexpected error during filter generation:', error);
      
      if (this.config.enableFallback) {
        return this.generateFallbackResponse(
          rawQuery, 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Apply AI-generated filters to a list of recruitment posts
   */
  applyFilters(
    posts: RecruitmentPost[], 
    aiQuery: AIQuery
  ): FilterApplicationResult {
    console.log(`[AIRecommender] Applying filters to ${posts.length} posts`);
    
    if (!posts || posts.length === 0) {
      return {
        filteredPosts: [],
        totalMatches: 0,
        appliedFilters: aiQuery.processedFilters,
        confidence: aiQuery.confidence,
        suggestions: aiQuery.suggestions,
        modelUsed: aiQuery.modelUsed,
        fallbackAttempts: aiQuery.fallbackAttempts,
        statistics: getFilterStatistics([], [], aiQuery.processedFilters),
      };
    }

    // Validate filters
    const validation = validateFilters(aiQuery.processedFilters);
    if (!validation.isValid) {
      console.warn('[AIRecommender] Invalid filters detected:', validation.errors);
      return {
        filteredPosts: posts,
        totalMatches: posts.length,
        appliedFilters: {},
        confidence: 0.1,
        suggestions: [
          'Filter validation failed',
          ...validation.errors.slice(0, 2),
        ],
        modelUsed: aiQuery.modelUsed,
        fallbackAttempts: aiQuery.fallbackAttempts,
        validation,
        statistics: getFilterStatistics(posts, posts, {}),
      };
    }

    // If confidence is too low, return all posts with suggestions
    if (aiQuery.confidence < this.config.minConfidenceThreshold) {
      console.warn(`[AIRecommender] Low confidence (${aiQuery.confidence}), returning all posts`);
      return {
        filteredPosts: posts,
        totalMatches: posts.length,
        appliedFilters: {},
        confidence: aiQuery.confidence,
        suggestions: aiQuery.suggestions || this.getDefaultSuggestions(),
        modelUsed: aiQuery.modelUsed,
        fallbackAttempts: aiQuery.fallbackAttempts,
        validation,
        statistics: getFilterStatistics(posts, posts, {}),
      };
    }

    // Apply filters using utility functions
    const filteredPosts = applyAllFilters(posts, aiQuery.processedFilters);
    const statistics = getFilterStatistics(posts, filteredPosts, aiQuery.processedFilters);
    
    console.log(`[AIRecommender] Filtered ${posts.length} posts to ${filteredPosts.length} matches`);
    
    return {
      filteredPosts,
      totalMatches: filteredPosts.length,
      appliedFilters: aiQuery.processedFilters,
      confidence: aiQuery.confidence,
      suggestions: filteredPosts.length === 0 ? this.getNoResultsSuggestions() : undefined,
      modelUsed: aiQuery.modelUsed,
      fallbackAttempts: aiQuery.fallbackAttempts,
      validation,
      statistics,
    };
  }

  /**
   * Enhance AI query with additional processing and validation
   */
  private enhanceAIQuery(aiQuery: AIQuery): AIQuery {
    // Validate and normalize filters
    const enhancedFilters = this.normalizeFilters(aiQuery.processedFilters);
    
    // Adjust confidence based on filter specificity
    let adjustedConfidence = aiQuery.confidence;
    
    // Boost confidence for specific filters
    if (enhancedFilters.positions && enhancedFilters.positions.length > 0) {
      adjustedConfidence += 0.1;
    }
    if (enhancedFilters.dates) {
      adjustedConfidence += 0.1;
    }
    if (enhancedFilters.times) {
      adjustedConfidence += 0.1;
    }
    
    // Cap confidence at 1.0
    adjustedConfidence = Math.min(adjustedConfidence, 1.0);
    
    return {
      ...aiQuery,
      processedFilters: enhancedFilters,
      confidence: adjustedConfidence,
      suggestions: aiQuery.suggestions || this.getDefaultSuggestions(),
    };
  }

  /**
   * Normalize and validate filters
   */
  private normalizeFilters(filters: PostFilters): PostFilters {
    const normalized: PostFilters = {};

    // Normalize positions
    if (filters.positions && filters.positions.length > 0) {
      normalized.positions = filters.positions.map(pos => pos.toLowerCase().trim());
    }

    // Validate dates
    if (filters.dates) {
      const startDate = new Date(filters.dates.startDate);
      const endDate = new Date(filters.dates.endDate);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        normalized.dates = {
          startDate,
          endDate: endDate < startDate ? startDate : endDate, // Ensure end >= start
        };
      }
    }

    // Validate times
    if (filters.times) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (timeRegex.test(filters.times.startTime) && timeRegex.test(filters.times.endTime)) {
        normalized.times = filters.times;
      }
    }

    // Normalize locations
    if (filters.locations && filters.locations.length > 0) {
      normalized.locations = filters.locations.map(loc => loc.toLowerCase().trim());
    }

    // Validate skill levels
    if (filters.skillLevels && filters.skillLevels.length > 0) {
      const validSkillLevels = Object.values(SkillLevel);
      normalized.skillLevels = filters.skillLevels.filter(level => 
        validSkillLevels.includes(level)
      );
    }

    return normalized;
  }

  /**
   * Generate fallback response when AI processing fails
   */
  private generateFallbackResponse(
    rawQuery: string, 
    error?: string
  ): OpenRouterApiResponse<AIQuery> {
    console.log(`[AIRecommender] Generating fallback response for query: "${rawQuery}"`);
    
    return {
      success: true,
      data: {
        rawQuery,
        processedFilters: {},
        confidence: 0.1,
        suggestions: [
          'AI processing is currently unavailable',
          'Try being more specific about what you\'re looking for',
          'Include position, date, time, or location in your search',
        ],
        fallbackAttempts: 999, // Indicate this is a fallback response
      },
    };
  }

  /**
   * Get default suggestions for unclear queries
   */
  private getDefaultSuggestions(): string[] {
    return [
      'Try: "Find batsman needed tomorrow morning"',
      'Try: "Looking for weekend matches"',
      'Try: "Need wicket keeper for evening game"',
    ].slice(0, this.config.maxSuggestions);
  }

  /**
   * Get suggestions when no results are found
   */
  private getNoResultsSuggestions(): string[] {
    return [
      'Try broadening your search criteria',
      'Check if the date or time is too specific',
      'Consider nearby locations or different positions',
    ].slice(0, this.config.maxSuggestions);
  }

  /**
   * Get current configuration
   */
  getConfig(): AIRecommenderConfig {
    return { ...this.config };
  }

  /**
   * Test the AI recommender with a sample query
   */
  async testRecommender(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.generateFilters('test query for batsman tomorrow');
      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default new AIRecommender();