/**
 * Query Processor for Natural Language Parsing
 * 
 * This processor handles natural language input validation, preprocessing,
 * and coordination with the AI recommender system for cricket recruitment post filtering.
 */

import { AIQuery, PostFilters } from '../types';
import openRouterApiClient, { OpenRouterApiClient } from '../services/openRouterApiClient';

export interface QueryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedQuery?: string;
}

export interface QueryPreprocessingOptions {
  trimWhitespace?: boolean;
  normalizeCase?: boolean;
  expandAbbreviations?: boolean;
  correctSpelling?: boolean;
}

export interface QueryHistory {
  query: string;
  timestamp: Date;
  success: boolean;
  filters?: PostFilters;
  confidence?: number;
}

export class QueryProcessor {
  private readonly aiClient: OpenRouterApiClient;
  private readonly queryHistory: QueryHistory[] = [];
  private readonly maxHistorySize: number = 50;
  
  // Common cricket abbreviations and their expansions
  private readonly abbreviations: Record<string, string> = {
    'bat': 'batsman',
    'bowl': 'bowler',
    'wk': 'wicket-keeper',
    'ar': 'all-rounder',
    'allrounder': 'all-rounder',
    'keeper': 'wicket-keeper',
    'wicketkeeper': 'wicket-keeper',
    'tm': 'tomorrow',
    'tmrw': 'tomorrow',
    'tod': 'today',
    'sat': 'saturday',
    'sun': 'sunday',
    'mon': 'monday',
    'tue': 'tuesday',
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'morn': 'morning',
    'eve': 'evening',
    'aft': 'afternoon',
    'nite': 'night',
    'nght': 'night',
  };

  // Common spelling corrections
  private readonly spellingCorrections: Record<string, string> = {
    'batsmen': 'batsman',
    'bowlers': 'bowler',
    'wicketkeepers': 'wicket-keeper',
    'allrounders': 'all-rounder',
    'tommorrow': 'tomorrow',
    'tomorow': 'tomorrow',
    'todya': 'today',
    'satruday': 'saturday',
    'sunday': 'sunday',
    'morining': 'morning',
    'evenign': 'evening',
    'afternnon': 'afternoon',
  };

  constructor(aiClient?: OpenRouterApiClient) {
    this.aiClient = aiClient || openRouterApiClient;
  }

  /**
   * Process natural language query with validation, preprocessing, and AI integration
   */
  async processQuery(
    rawQuery: string,
    options: QueryPreprocessingOptions = {}
  ): Promise<AIQuery> {
    // Step 1: Validate the query
    const validation = this.validateQuery(rawQuery);
    if (!validation.isValid) {
      return {
        rawQuery,
        processedFilters: {},
        confidence: 0.1,
        suggestions: [
          'Please provide a valid search query',
          'Try: "Find batsman needed tomorrow morning"',
          'Try: "Looking for weekend matches"',
          ...validation.errors,
        ],
      };
    }

    // Step 2: Preprocess the query
    const preprocessedQuery = this.preprocessQuery(validation.normalizedQuery || rawQuery, options);

    // Step 3: Process with AI
    try {
      const aiResult = await this.aiClient.processQuery(preprocessedQuery);
      
      if (aiResult.success && aiResult.data) {
        // Step 4: Post-process and enhance the AI result
        const enhancedResult = this.enhanceAIResult(aiResult.data, rawQuery, preprocessedQuery);
        
        // Step 5: Add to query history
        this.addToHistory({
          query: rawQuery,
          timestamp: new Date(),
          success: true,
          filters: enhancedResult.processedFilters,
          confidence: enhancedResult.confidence,
        });

        return enhancedResult;
      } else {
        // AI processing failed, return fallback
        const fallbackResult: AIQuery = {
          rawQuery,
          processedFilters: this.extractBasicFilters(preprocessedQuery),
          confidence: 0.3,
          suggestions: this.generateFallbackSuggestions(preprocessedQuery),
        };

        this.addToHistory({
          query: rawQuery,
          timestamp: new Date(),
          success: false,
        });

        return fallbackResult;
      }
    } catch (error) {
      console.error('[QueryProcessor] Error processing query:', error);
      
      // Return basic fallback
      const fallbackResult: AIQuery = {
        rawQuery,
        processedFilters: this.extractBasicFilters(preprocessedQuery),
        confidence: 0.2,
        suggestions: [
          'AI processing temporarily unavailable',
          'Try a simpler query like "find batsman"',
          'Check your internet connection',
        ],
      };

      this.addToHistory({
        query: rawQuery,
        timestamp: new Date(),
        success: false,
      });

      return fallbackResult;
    }
  }

  /**
   * Validate natural language query
   */
  validateQuery(query: string): QueryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if query is empty or only whitespace
    if (!query || query.trim().length === 0) {
      errors.push('Query cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check minimum length
    if (query.trim().length < 2) {
      errors.push('Query is too short (minimum 2 characters)');
      return { isValid: false, errors, warnings };
    }

    // Check maximum length
    if (query.length > 500) {
      errors.push('Query is too long (maximum 500 characters)');
      return { isValid: false, errors, warnings };
    }

    // Check for potentially problematic characters
    const problematicChars = /[<>{}[\]\\]/g;
    if (problematicChars.test(query)) {
      warnings.push('Query contains special characters that might affect processing');
    }

    // Check if query is mostly numbers (might be accidental input)
    const numberRatio = (query.match(/\d/g) || []).length / query.length;
    if (numberRatio > 0.7) {
      warnings.push('Query appears to be mostly numbers - consider adding descriptive text');
    }

    // Normalize the query
    const normalizedQuery = query.trim().toLowerCase();

    return {
      isValid: true,
      errors,
      warnings,
      normalizedQuery,
    };
  }

  /**
   * Preprocess query with various normalization options
   */
  preprocessQuery(query: string, options: QueryPreprocessingOptions = {}): string {
    let processed = query;

    // Default options
    const opts = {
      trimWhitespace: true,
      normalizeCase: true,
      expandAbbreviations: true,
      correctSpelling: true,
      ...options,
    };

    // Trim whitespace
    if (opts.trimWhitespace) {
      processed = processed.trim();
    }

    // Normalize case
    if (opts.normalizeCase) {
      processed = processed.toLowerCase();
    }

    // Expand abbreviations
    if (opts.expandAbbreviations) {
      processed = this.expandAbbreviations(processed);
    }

    // Correct common spelling mistakes
    if (opts.correctSpelling) {
      processed = this.correctSpelling(processed);
    }

    // Normalize multiple spaces
    processed = processed.replace(/\s+/g, ' ');

    return processed;
  }

  /**
   * Expand common cricket abbreviations
   */
  private expandAbbreviations(query: string): string {
    let expanded = query;
    
    // Use word boundaries to avoid partial matches
    Object.entries(this.abbreviations).forEach(([abbrev, expansion]) => {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      expanded = expanded.replace(regex, expansion);
    });

    return expanded;
  }

  /**
   * Correct common spelling mistakes
   */
  private correctSpelling(query: string): string {
    let corrected = query;
    
    Object.entries(this.spellingCorrections).forEach(([mistake, correction]) => {
      const regex = new RegExp(`\\b${mistake}\\b`, 'gi');
      corrected = corrected.replace(regex, correction);
    });

    return corrected;
  }

  /**
   * Enhance AI result with additional processing and validation
   */
  private enhanceAIResult(aiResult: AIQuery, originalQuery: string, preprocessedQuery: string): AIQuery {
    // Validate and clean up the processed filters
    const cleanedFilters = this.validateAndCleanFilters(aiResult.processedFilters);
    
    // Adjust confidence based on query complexity and preprocessing changes
    let adjustedConfidence = aiResult.confidence;
    
    // Lower confidence if query was heavily preprocessed
    if (originalQuery.toLowerCase() !== preprocessedQuery) {
      adjustedConfidence *= 0.9;
    }
    
    // Lower confidence if filters seem incomplete for a complex query
    const queryComplexity = this.assessQueryComplexity(originalQuery);
    const filterCompleteness = this.assessFilterCompleteness(cleanedFilters);
    
    if (queryComplexity > filterCompleteness) {
      adjustedConfidence *= 0.8;
    }

    // Generate enhanced suggestions
    const enhancedSuggestions = this.generateEnhancedSuggestions(
      originalQuery,
      cleanedFilters,
      aiResult.suggestions || []
    );

    return {
      rawQuery: originalQuery,
      processedFilters: cleanedFilters,
      confidence: Math.max(0.1, Math.min(1.0, adjustedConfidence)),
      suggestions: enhancedSuggestions,
      modelUsed: aiResult.modelUsed,
      fallbackAttempts: aiResult.fallbackAttempts,
    };
  }

  /**
   * Validate and clean processed filters
   */
  private validateAndCleanFilters(filters: PostFilters): PostFilters {
    const cleaned: PostFilters = {};

    // Validate positions
    if (filters.positions && Array.isArray(filters.positions)) {
      const validPositions = filters.positions.filter(pos => 
        typeof pos === 'string' && pos.length > 0
      );
      if (validPositions.length > 0) {
        cleaned.positions = validPositions;
      }
    }

    // Validate dates
    if (filters.dates) {
      const { startDate, endDate } = filters.dates;
      if (startDate instanceof Date && !isNaN(startDate.getTime())) {
        cleaned.dates = { startDate, endDate: endDate || startDate };
      }
    }

    // Validate times
    if (filters.times) {
      const { startTime, endTime } = filters.times;
      if (this.isValidTimeFormat(startTime)) {
        cleaned.times = {
          startTime,
          endTime: this.isValidTimeFormat(endTime) ? endTime : startTime,
        };
      }
    }

    // Validate locations
    if (filters.locations && Array.isArray(filters.locations)) {
      const validLocations = filters.locations.filter(loc => 
        typeof loc === 'string' && loc.length > 0
      );
      if (validLocations.length > 0) {
        cleaned.locations = validLocations;
      }
    }

    // Validate skill levels
    if (filters.skillLevels && Array.isArray(filters.skillLevels)) {
      const validSkillLevels = filters.skillLevels.filter(level =>
        ['beginner', 'intermediate', 'advanced', 'professional'].includes(level)
      );
      if (validSkillLevels.length > 0) {
        cleaned.skillLevels = validSkillLevels as any;
      }
    }

    return cleaned;
  }

  /**
   * Check if time format is valid (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    if (!time || typeof time !== 'string') return false;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Assess query complexity (0-1 scale)
   */
  private assessQueryComplexity(query: string): number {
    let complexity = 0;
    
    // Length factor
    complexity += Math.min(query.length / 100, 0.3);
    
    // Number of cricket terms
    const cricketTerms = ['batsman', 'bowler', 'wicket-keeper', 'all-rounder', 'match', 'game', 'team'];
    const termCount = cricketTerms.filter(term => query.toLowerCase().includes(term)).length;
    complexity += Math.min(termCount / 4, 0.3);
    
    // Time/date references
    const timeTerms = ['today', 'tomorrow', 'morning', 'evening', 'weekend', 'saturday', 'sunday'];
    const timeCount = timeTerms.filter(term => query.toLowerCase().includes(term)).length;
    complexity += Math.min(timeCount / 3, 0.2);
    
    // Location references
    if (query.toLowerCase().includes('near') || query.toLowerCase().includes('in ')) {
      complexity += 0.2;
    }
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Assess filter completeness (0-1 scale)
   */
  private assessFilterCompleteness(filters: PostFilters): number {
    let completeness = 0;
    
    if (filters.positions && filters.positions.length > 0) completeness += 0.3;
    if (filters.dates) completeness += 0.3;
    if (filters.times) completeness += 0.2;
    if (filters.locations && filters.locations.length > 0) completeness += 0.1;
    if (filters.skillLevels && filters.skillLevels.length > 0) completeness += 0.1;
    
    return completeness;
  }

  /**
   * Extract basic filters using simple pattern matching (fallback)
   */
  private extractBasicFilters(query: string): PostFilters {
    const filters: PostFilters = {};
    const lowerQuery = query.toLowerCase();

    // Extract positions
    const positions: string[] = [];
    if (lowerQuery.includes('batsman') || lowerQuery.includes('bat ')) positions.push('batsman');
    if (lowerQuery.includes('bowler') || lowerQuery.includes('bowl')) positions.push('bowler');
    if (lowerQuery.includes('wicket-keeper') || lowerQuery.includes('keeper')) positions.push('wicket-keeper');
    if (lowerQuery.includes('all-rounder') || lowerQuery.includes('allrounder')) positions.push('all-rounder');
    
    if (positions.length > 0) {
      filters.positions = positions;
    }

    // Extract basic time references
    if (lowerQuery.includes('morning')) {
      filters.times = { startTime: '06:00', endTime: '12:00' };
    } else if (lowerQuery.includes('evening')) {
      filters.times = { startTime: '18:00', endTime: '22:00' };
    } else if (lowerQuery.includes('afternoon')) {
      filters.times = { startTime: '12:00', endTime: '18:00' };
    }

    // Extract basic date references
    if (lowerQuery.includes('today')) {
      const today = new Date();
      filters.dates = { startDate: today, endDate: today };
    } else if (lowerQuery.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      filters.dates = { startDate: tomorrow, endDate: tomorrow };
    }

    return filters;
  }

  /**
   * Generate fallback suggestions when AI processing fails
   */
  private generateFallbackSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    
    // Basic suggestions
    suggestions.push('Try: "Find batsman needed tomorrow morning"');
    suggestions.push('Try: "Looking for weekend matches"');
    suggestions.push('Try: "Need wicket keeper for evening game"');
    
    // Query-specific suggestions
    if (!query.toLowerCase().includes('batsman') && !query.toLowerCase().includes('bowler')) {
      suggestions.push('Specify the position needed (batsman, bowler, wicket-keeper, all-rounder)');
    }
    
    if (!query.toLowerCase().includes('today') && !query.toLowerCase().includes('tomorrow')) {
      suggestions.push('Include when you need players (today, tomorrow, weekend)');
    }
    
    if (!query.toLowerCase().includes('morning') && !query.toLowerCase().includes('evening')) {
      suggestions.push('Mention preferred time (morning, afternoon, evening)');
    }

    return suggestions;
  }

  /**
   * Generate enhanced suggestions based on AI result and query analysis
   */
  private generateEnhancedSuggestions(
    originalQuery: string,
    filters: PostFilters,
    aiSuggestions: string[]
  ): string[] {
    const suggestions = [...aiSuggestions];
    
    // Add suggestions based on missing filters
    if (!filters.positions || filters.positions.length === 0) {
      suggestions.push('Try specifying the position: "Find batsman for tomorrow"');
    }
    
    if (!filters.dates) {
      suggestions.push('Try adding a date: "Find players for weekend"');
    }
    
    if (!filters.times) {
      suggestions.push('Try adding time preference: "Find players for morning match"');
    }

    // Add suggestions from query history
    const historySuggestions = this.getHistoryBasedSuggestions(originalQuery);
    suggestions.push(...historySuggestions);

    // Remove duplicates and limit to 5 suggestions
    return [...new Set(suggestions)].slice(0, 5);
  }

  /**
   * Get suggestions based on query history
   */
  private getHistoryBasedSuggestions(currentQuery: string): string[] {
    const suggestions: string[] = [];
    
    // Find similar successful queries
    const similarQueries = this.queryHistory
      .filter(h => h.success && this.calculateQuerySimilarity(currentQuery, h.query) > 0.3)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 2);

    similarQueries.forEach(h => {
      suggestions.push(`Try: "${h.query}"`);
    });

    return suggestions;
  }

  /**
   * Calculate similarity between two queries (0-1 scale)
   */
  private calculateQuerySimilarity(query1: string, query2: string): number {
    const words1 = query1.toLowerCase().split(/\s+/);
    const words2 = query2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * Add query to history
   */
  private addToHistory(entry: QueryHistory): void {
    this.queryHistory.unshift(entry);
    
    // Limit history size
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory.splice(this.maxHistorySize);
    }
  }

  /**
   * Get query history
   */
  getQueryHistory(): QueryHistory[] {
    return [...this.queryHistory];
  }

  /**
   * Clear query history
   */
  clearQueryHistory(): void {
    this.queryHistory.length = 0;
  }

  /**
   * Get query suggestions based on history and common patterns
   */
  getQuerySuggestions(): string[] {
    const suggestions = [
      'Find batsman needed tomorrow morning',
      'Looking for weekend matches',
      'Need wicket keeper for evening game',
      'Find all-rounder for Saturday match',
      'Looking for bowler today afternoon',
      'Need players for Sunday morning',
      'Find competitive team match',
      'Looking for casual game tonight',
    ];

    // Add recent successful queries
    const recentSuccessful = this.queryHistory
      .filter(h => h.success)
      .slice(0, 3)
      .map(h => h.query);

    return [...new Set([...suggestions, ...recentSuccessful])];
  }
}

export default new QueryProcessor();