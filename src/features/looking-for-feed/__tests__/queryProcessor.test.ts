import * as fc from 'fast-check';
import { QueryProcessor } from '../utils/queryProcessor';
import { OpenRouterApiClient } from '../services/openRouterApiClient';

// Mock the OpenRouter API client
const mockOpenRouterClient = {
  processQuery: jest.fn(),
} as unknown as OpenRouterApiClient;

describe('Query Processor', () => {
  let queryProcessor: QueryProcessor;

  beforeEach(() => {
    queryProcessor = new QueryProcessor(mockOpenRouterClient);
    (mockOpenRouterClient.processQuery as jest.Mock).mockClear();
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 4: Natural language query processing
     * **Validates: Requirements 2.1**
     * 
     * For any natural language query input, the QueryProcessor should validate,
     * preprocess, and coordinate with the AI system to return structured filter criteria.
     */
    it('Property 4: Natural language query processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 200 }), // Valid query length range
          async (query) => {
            // Mock successful AI response
            (mockOpenRouterClient.processQuery as jest.Mock).mockResolvedValue({
              success: true,
              data: {
                rawQuery: query,
                processedFilters: {
                  positions: ['batsman'],
                  dates: { startDate: new Date(), endDate: new Date() },
                  times: { startTime: '09:00', endTime: '12:00' }
                },
                confidence: 0.8,
                suggestions: ['Try being more specific'],
                modelUsed: 'test-model',
                fallbackAttempts: 0
              }
            });

            const result = await queryProcessor.processQuery(query);

            // Result should always have required structure
            expect(typeof result).toBe('object');
            expect(result).not.toBeNull();
            expect(typeof result.rawQuery).toBe('string');
            expect(result.rawQuery).toBe(query);
            expect(typeof result.processedFilters).toBe('object');
            expect(result.processedFilters).not.toBeNull();
            expect(typeof result.confidence).toBe('number');
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);

            // Suggestions should be array if present
            if (result.suggestions) {
              expect(Array.isArray(result.suggestions)).toBe(true);
              result.suggestions.forEach(suggestion => {
                expect(typeof suggestion).toBe('string');
                expect(suggestion.length).toBeGreaterThan(0);
              });
            }

            // Processed filters should have valid structure
            const { processedFilters } = result;
            
            if (processedFilters.positions) {
              expect(Array.isArray(processedFilters.positions)).toBe(true);
              processedFilters.positions.forEach(position => {
                expect(typeof position).toBe('string');
                expect(position.length).toBeGreaterThan(0);
              });
            }

            if (processedFilters.dates) {
              expect(processedFilters.dates.startDate).toBeInstanceOf(Date);
              expect(processedFilters.dates.endDate).toBeInstanceOf(Date);
              expect(processedFilters.dates.startDate.getTime()).toBeLessThanOrEqual(
                processedFilters.dates.endDate.getTime()
              );
            }

            if (processedFilters.times) {
              expect(typeof processedFilters.times.startTime).toBe('string');
              expect(typeof processedFilters.times.endTime).toBe('string');
              expect(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(processedFilters.times.startTime)).toBe(true);
              expect(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(processedFilters.times.endTime)).toBe(true);
            }

            if (processedFilters.locations) {
              expect(Array.isArray(processedFilters.locations)).toBe(true);
              processedFilters.locations.forEach(location => {
                expect(typeof location).toBe('string');
                expect(location.length).toBeGreaterThan(0);
              });
            }

            if (processedFilters.skillLevels) {
              expect(Array.isArray(processedFilters.skillLevels)).toBe(true);
              processedFilters.skillLevels.forEach(level => {
                expect(['beginner', 'intermediate', 'advanced', 'professional']).toContain(level);
              });
            }

            // AI client should have been called for valid queries
            if (query.trim().length >= 2) {
              expect(mockOpenRouterClient.processQuery).toHaveBeenCalledTimes(1);
            }

            (mockOpenRouterClient.processQuery as jest.Mock).mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle AI processing failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 2, maxLength: 100 }),
          async (query) => {
            // Mock AI failure
            (mockOpenRouterClient.processQuery as jest.Mock).mockResolvedValue({
              success: false,
              error: 'AI processing failed'
            });

            const result = await queryProcessor.processQuery(query);

            // Should still return valid structure
            expect(result.rawQuery).toBe(query);
            expect(typeof result.processedFilters).toBe('object');
            expect(typeof result.confidence).toBe('number');
            expect(result.confidence).toBeGreaterThan(0);
            expect(Array.isArray(result.suggestions)).toBe(true);
            expect(result.suggestions!.length).toBeGreaterThan(0);

            (mockOpenRouterClient.processQuery as jest.Mock).mockClear();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should validate queries correctly', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 2, maxLength: 500 }), // Valid queries
            fc.string({ minLength: 0, maxLength: 1 }),   // Too short
            fc.string({ minLength: 501, maxLength: 1000 }), // Too long
            fc.constant(''),                              // Empty
            fc.constant('   '),                          // Whitespace only
            fc.string().map(s => s + '<script>alert("test")</script>') // With problematic chars
          ),
          (query) => {
            const validation = queryProcessor.validateQuery(query);

            // Validation result should have required structure
            expect(typeof validation.isValid).toBe('boolean');
            expect(Array.isArray(validation.errors)).toBe(true);
            expect(Array.isArray(validation.warnings)).toBe(true);

            // Check validation logic
            if (!query || query.trim().length === 0) {
              expect(validation.isValid).toBe(false);
              expect(validation.errors.length).toBeGreaterThan(0);
            } else if (query.trim().length < 2) {
              expect(validation.isValid).toBe(false);
              expect(validation.errors.some(e => e.includes('too short'))).toBe(true);
            } else if (query.length > 500) {
              expect(validation.isValid).toBe(false);
              expect(validation.errors.some(e => e.includes('too long'))).toBe(true);
            } else {
              expect(validation.isValid).toBe(true);
              if (validation.normalizedQuery) {
                expect(typeof validation.normalizedQuery).toBe('string');
                expect(validation.normalizedQuery.length).toBeGreaterThan(0);
              }
            }

            // Warnings should be strings
            validation.warnings.forEach(warning => {
              expect(typeof warning).toBe('string');
              expect(warning.length).toBeGreaterThan(0);
            });

            // Errors should be strings
            validation.errors.forEach(error => {
              expect(typeof error).toBe('string');
              expect(error.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preprocess queries consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.record({
            trimWhitespace: fc.boolean(),
            normalizeCase: fc.boolean(),
            expandAbbreviations: fc.boolean(),
            correctSpelling: fc.boolean()
          }),
          (query, options) => {
            const preprocessed = queryProcessor.preprocessQuery(query, options);

            // Preprocessed query should be a string
            expect(typeof preprocessed).toBe('string');

            // Should not be longer than original (only transformations, no additions)
            // Allow some flexibility for abbreviation expansion
            expect(preprocessed.length).toBeLessThanOrEqual(query.length * 2);

            // If trimWhitespace is true, should not have leading/trailing spaces
            if (options.trimWhitespace) {
              expect(preprocessed).toBe(preprocessed.trim());
            }

            // If normalizeCase is true, should be lowercase
            if (options.normalizeCase) {
              expect(preprocessed).toBe(preprocessed.toLowerCase());
            }

            // Should not have multiple consecutive spaces
            expect(preprocessed).not.toMatch(/\s{2,}/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should extract basic filters as fallback', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('find batsman for tomorrow morning'),
            fc.constant('need bowler today evening'),
            fc.constant('looking for wicket-keeper weekend'),
            fc.constant('all-rounder needed afternoon'),
            fc.string({ minLength: 5, maxLength: 100 })
          ),
          (query) => {
            const filters = (queryProcessor as any).extractBasicFilters(query.toLowerCase());

            // Filters should be valid object
            expect(typeof filters).toBe('object');
            expect(filters).not.toBeNull();

            // Check positions extraction
            if (filters.positions) {
              expect(Array.isArray(filters.positions)).toBe(true);
              filters.positions.forEach((position: string) => {
                expect(['batsman', 'bowler', 'wicket-keeper', 'all-rounder']).toContain(position);
              });
            }

            // Check times extraction
            if (filters.times) {
              expect(typeof filters.times.startTime).toBe('string');
              expect(typeof filters.times.endTime).toBe('string');
              expect(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(filters.times.startTime)).toBe(true);
              expect(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(filters.times.endTime)).toBe(true);
            }

            // Check dates extraction
            if (filters.dates) {
              expect(filters.dates.startDate).toBeInstanceOf(Date);
              expect(filters.dates.endDate).toBeInstanceOf(Date);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain query history correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 2, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          async (queries) => {
            // Clear history first
            queryProcessor.clearQueryHistory();

            // Mock AI responses
            (mockOpenRouterClient.processQuery as jest.Mock).mockResolvedValue({
              success: true,
              data: {
                rawQuery: 'test',
                processedFilters: {},
                confidence: 0.5,
                suggestions: []
              }
            });

            // Process all queries
            for (const query of queries) {
              await queryProcessor.processQuery(query);
            }

            const history = queryProcessor.getQueryHistory();

            // History should not exceed max size (50)
            expect(history.length).toBeLessThanOrEqual(50);
            expect(history.length).toBeLessThanOrEqual(queries.length);

            // History entries should have valid structure
            history.forEach(entry => {
              expect(typeof entry.query).toBe('string');
              expect(entry.timestamp).toBeInstanceOf(Date);
              expect(typeof entry.success).toBe('boolean');
              
              if (entry.filters) {
                expect(typeof entry.filters).toBe('object');
              }
              
              if (entry.confidence !== undefined) {
                expect(typeof entry.confidence).toBe('number');
                expect(entry.confidence).toBeGreaterThanOrEqual(0);
                expect(entry.confidence).toBeLessThanOrEqual(1);
              }
            });

            // Most recent queries should be first
            if (history.length > 1) {
              for (let i = 0; i < history.length - 1; i++) {
                expect(history[i].timestamp.getTime()).toBeGreaterThanOrEqual(
                  history[i + 1].timestamp.getTime()
                );
              }
            }

            (mockOpenRouterClient.processQuery as jest.Mock).mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should create processor with default AI client', () => {
      const defaultProcessor = new QueryProcessor();
      expect(defaultProcessor).toBeDefined();
      expect(defaultProcessor.validateQuery).toBeDefined();
      expect(defaultProcessor.preprocessQuery).toBeDefined();
      expect(defaultProcessor.processQuery).toBeDefined();
    });

    it('should handle empty query validation', () => {
      const validation = queryProcessor.validateQuery('');
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Query cannot be empty');
    });

    it('should handle whitespace-only query validation', () => {
      const validation = queryProcessor.validateQuery('   ');
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Query cannot be empty');
    });

    it('should expand common abbreviations', () => {
      const expanded = queryProcessor.preprocessQuery('find bat and wk for tm');
      expect(expanded).toContain('batsman');
      expect(expanded).toContain('wicket-keeper');
      expect(expanded).toContain('tomorrow');
    });

    it('should correct common spelling mistakes', () => {
      const corrected = queryProcessor.preprocessQuery('find batsmen for tommorrow');
      expect(corrected).toContain('batsman');
      expect(corrected).toContain('tomorrow');
    });

    it('should provide query suggestions', () => {
      const suggestions = queryProcessor.getQuerySuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      });
    });

    it('should clear query history', async () => {
      // Mock AI response
      (mockOpenRouterClient.processQuery as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          rawQuery: 'test',
          processedFilters: {},
          confidence: 0.5,
          suggestions: []
        }
      });

      // Add some queries to history
      await queryProcessor.processQuery('test query 1');
      await queryProcessor.processQuery('test query 2');
      
      expect(queryProcessor.getQueryHistory().length).toBe(2);
      
      queryProcessor.clearQueryHistory();
      expect(queryProcessor.getQueryHistory().length).toBe(0);
    });

    it('should handle AI client errors gracefully', async () => {
      // Mock AI client to throw error
      (mockOpenRouterClient.processQuery as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await queryProcessor.processQuery('test query');

      expect(result.rawQuery).toBe('test query');
      expect(result.confidence).toBeLessThan(0.5);
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions!.some(s => s.includes('temporarily unavailable'))).toBe(true);
    });

    it('should validate time format correctly', () => {
      const processor = queryProcessor as any;
      
      expect(processor.isValidTimeFormat('09:30')).toBe(true);
      expect(processor.isValidTimeFormat('23:59')).toBe(true);
      expect(processor.isValidTimeFormat('00:00')).toBe(true);
      expect(processor.isValidTimeFormat('12:00')).toBe(true);
      
      expect(processor.isValidTimeFormat('24:00')).toBe(false);
      expect(processor.isValidTimeFormat('12:60')).toBe(false);
      expect(processor.isValidTimeFormat('9:30')).toBe(true); // Single digit hour is valid
      expect(processor.isValidTimeFormat('invalid')).toBe(false);
      expect(processor.isValidTimeFormat('')).toBe(false);
      expect(processor.isValidTimeFormat(null)).toBe(false);
    });
  });
});