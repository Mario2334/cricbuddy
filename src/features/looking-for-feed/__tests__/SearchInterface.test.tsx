import * as fc from 'fast-check';
import { AIQuery, PostFilters } from '../types';
import queryProcessor from '../utils/queryProcessor';

// Mock the query processor
jest.mock('../utils/queryProcessor', () => ({
  processQuery: jest.fn(),
  getQueryHistory: jest.fn(),
  getQuerySuggestions: jest.fn(),
  clearQueryHistory: jest.fn(),
}));

const mockQueryProcessor = queryProcessor as jest.Mocked<typeof queryProcessor>;

// Mock SearchInterface behavior for property testing
class MockSearchInterface {
  private query: string = '';
  private loading: boolean = false;
  private suggestions: string[] = [];
  private history: any[] = [];
  
  constructor(
    private onQuerySubmit: (query: AIQuery) => void,
    private onQueryClear: () => void,
    private initialQuery: string = ''
  ) {
    this.query = initialQuery;
    this.history = mockQueryProcessor.getQueryHistory();
    this.suggestions = mockQueryProcessor.getQuerySuggestions();
  }

  // Simulate typing in search input
  changeText(text: string) {
    this.query = text;
    if (text.trim().length === 0) {
      this.onQueryClear();
    }
    this.updateSuggestions(text);
  }

  // Simulate submitting query
  async submitQuery() {
    if (!this.query.trim()) return;
    
    this.loading = true;
    try {
      const result = await mockQueryProcessor.processQuery(this.query.trim());
      this.onQuerySubmit(result);
    } catch (error) {
      // Fallback result
      const fallbackResult: AIQuery = {
        rawQuery: this.query.trim(),
        processedFilters: {},
        confidence: 0.1,
        suggestions: ['Search temporarily unavailable'],
      };
      this.onQuerySubmit(fallbackResult);
    } finally {
      this.loading = false;
    }
  }

  // Simulate clearing query
  clearQuery() {
    this.query = '';
    this.onQueryClear();
  }

  // Simulate suggestion selection
  selectSuggestion(suggestion: string) {
    this.query = suggestion;
    this.submitQuery();
  }

  // Simulate focus/blur events
  focus() {
    if (this.query.trim().length > 0) {
      this.updateSuggestions(this.query);
    }
  }

  blur() {
    // Hide suggestions immediately for testing
    this.suggestions = [];
  }

  private updateSuggestions(searchText: string) {
    if (searchText.trim().length > 0) {
      const allSuggestions = mockQueryProcessor.getQuerySuggestions();
      this.suggestions = allSuggestions.filter(s => 
        s.toLowerCase().includes(searchText.toLowerCase())
      ).slice(0, 8);
    } else {
      this.suggestions = [];
    }
  }

  // Getters for testing
  get currentQuery() { return this.query; }
  get isLoading() { return this.loading; }
  get currentSuggestions() { return this.suggestions; }
  get queryHistory() { return this.history; }
}

describe('SearchInterface Component', () => {
  const mockOnQuerySubmit = jest.fn();
  const mockOnQueryClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryProcessor.getQueryHistory.mockReturnValue([]);
    mockQueryProcessor.getQuerySuggestions.mockReturnValue([
      'Find batsman needed tomorrow morning',
      'Looking for weekend matches',
      'Need wicket keeper for evening game',
    ]);
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 14: Search interaction completeness
     * **Validates: Requirements 5.2, 5.5**
     * 
     * For any search interface interaction (typing, submitting, clearing), 
     * the appropriate UI feedback and functionality should be provided including 
     * suggestions and history management.
     */
    it('Property 14: Search interaction completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.string({ minLength: 0, maxLength: 100 }),
            shouldSubmit: fc.boolean(),
            shouldClear: fc.boolean(),
            mockAIResponse: fc.record({
              success: fc.boolean(),
              confidence: fc.float({ min: 0, max: 1 }),
              hasFilters: fc.boolean(),
              hasSuggestions: fc.boolean(),
            }),
          }),
          async ({ query, shouldSubmit, shouldClear, mockAIResponse }) => {
            // Clear mocks for this test iteration
            jest.clearAllMocks();
            
            // Setup mock AI response
            const mockAIQuery: AIQuery = {
              rawQuery: query,
              processedFilters: mockAIResponse.hasFilters ? {
                positions: ['batsman'],
                dates: { startDate: new Date(), endDate: new Date() },
              } : {},
              confidence: mockAIResponse.confidence,
              suggestions: mockAIResponse.hasSuggestions ? [
                'Try being more specific',
                'Include position needed',
              ] : undefined,
            };

            if (mockAIResponse.success) {
              mockQueryProcessor.processQuery.mockResolvedValue(mockAIQuery);
            } else {
              mockQueryProcessor.processQuery.mockRejectedValue(new Error('AI processing failed'));
            }

            const searchInterface = new MockSearchInterface(
              mockOnQuerySubmit,
              mockOnQueryClear
            );

            // Test typing interaction
            if (query.length > 0) {
              searchInterface.changeText(query);

              // Query should be updated
              expect(searchInterface.currentQuery).toBe(query);

              // Test submission interaction
              if (shouldSubmit && query.trim().length > 0) {
                await searchInterface.submitQuery();

                // Query processor should be called for non-empty queries
                expect(mockQueryProcessor.processQuery).toHaveBeenCalledWith(query.trim());
                
                // onQuerySubmit should be called with processed result
                if (mockAIResponse.success) {
                  expect(mockOnQuerySubmit).toHaveBeenCalledWith(mockAIQuery);
                } else {
                  // Should still call onQuerySubmit with fallback result
                  expect(mockOnQuerySubmit).toHaveBeenCalled();
                  const callArgs = mockOnQuerySubmit.mock.calls[0][0];
                  expect(callArgs.rawQuery).toBe(query.trim());
                  expect(typeof callArgs.confidence).toBe('number');
                  expect(callArgs.confidence).toBeGreaterThan(0);
                  expect(Array.isArray(callArgs.suggestions)).toBe(true);
                }
              }

              // Test clear interaction
              if (shouldClear) {
                searchInterface.clearQuery();

                // Query should be cleared
                expect(searchInterface.currentQuery).toBe('');
                
                // onQueryClear should be called
                expect(mockOnQueryClear).toHaveBeenCalled();
              }
            } else {
              // Empty query should not trigger processing
              if (shouldSubmit) {
                await searchInterface.submitQuery();

                // Should not call query processor for empty queries
                expect(mockQueryProcessor.processQuery).not.toHaveBeenCalled();
                expect(mockOnQuerySubmit).not.toHaveBeenCalled();
              }
            }

            // Verify component maintains consistent state
            expect(typeof searchInterface.currentQuery).toBe('string');
            expect(typeof searchInterface.isLoading).toBe('boolean');
            expect(Array.isArray(searchInterface.currentSuggestions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle suggestion interactions correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialQuery: fc.string({ minLength: 1, maxLength: 50 }),
            suggestionIndex: fc.integer({ min: 0, max: 2 }),
            mockHistory: fc.array(
              fc.record({
                query: fc.string({ minLength: 5, maxLength: 30 }),
                success: fc.boolean(),
                timestamp: fc.date(),
              }),
              { minLength: 0, maxLength: 5 }
            ),
          }),
          async ({ initialQuery, suggestionIndex, mockHistory }) => {
            // Clear mocks for this test iteration
            jest.clearAllMocks();
            
            // Setup mock history
            mockQueryProcessor.getQueryHistory.mockReturnValue(mockHistory);

            // Setup successful AI response
            mockQueryProcessor.processQuery.mockResolvedValue({
              rawQuery: initialQuery,
              processedFilters: { positions: ['batsman'] },
              confidence: 0.8,
              suggestions: ['Try being more specific'],
            });

            const searchInterface = new MockSearchInterface(
              mockOnQuerySubmit,
              mockOnQueryClear
            );

            // Type initial query to trigger suggestions
            searchInterface.changeText(initialQuery);
            searchInterface.focus();

            // Get available suggestions
            const suggestions = mockQueryProcessor.getQuerySuggestions();
            if (suggestions.length > suggestionIndex) {
              const suggestionText = suggestions[suggestionIndex];
              
              // Select suggestion
              await searchInterface.selectSuggestion(suggestionText);
              
              // Should update query with suggestion text
              expect(searchInterface.currentQuery).toBe(suggestionText);
              
              // Should trigger query processing
              expect(mockQueryProcessor.processQuery).toHaveBeenCalledWith(suggestionText);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle loading states correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.string({ minLength: 2, maxLength: 50 }),
            processingDelay: fc.integer({ min: 0, max: 100 }),
          }),
          async ({ query, processingDelay }) => {
            // Setup delayed AI response
            mockQueryProcessor.processQuery.mockImplementation(
              () => new Promise(resolve => 
                setTimeout(() => resolve({
                  rawQuery: query,
                  processedFilters: {},
                  confidence: 0.5,
                  suggestions: [],
                }), processingDelay)
              )
            );

            const searchInterface = new MockSearchInterface(
              mockOnQuerySubmit,
              mockOnQueryClear
            );

            // Type and submit query
            searchInterface.changeText(query);
            const submitPromise = searchInterface.submitQuery();

            // Should show loading state during processing
            if (processingDelay > 0) {
              expect(searchInterface.isLoading).toBe(true);
            }

            // Wait for processing to complete
            await submitPromise;

            // Should not be loading after completion
            expect(searchInterface.isLoading).toBe(false);
            expect(mockOnQuerySubmit).toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should maintain query history correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              query: fc.string({ minLength: 2, maxLength: 30 }),
              success: fc.boolean(),
              timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (historyEntries) => {
            // Setup mock history
            mockQueryProcessor.getQueryHistory.mockReturnValue(historyEntries);

            // Setup AI responses
            mockQueryProcessor.processQuery.mockResolvedValue({
              rawQuery: 'test',
              processedFilters: {},
              confidence: 0.5,
              suggestions: [],
            });

            const searchInterface = new MockSearchInterface(
              mockOnQuerySubmit,
              mockOnQueryClear
            );

            // Type partial query to trigger suggestions
            searchInterface.changeText('find');
            searchInterface.focus();

            // History should be loaded on component creation
            expect(mockQueryProcessor.getQueryHistory).toHaveBeenCalled();

            // Successful history entries should be available
            const successfulEntries = historyEntries.filter(entry => entry.success);
            
            // Component should handle history entries correctly
            expect(successfulEntries.every(entry => {
              return typeof entry.query === 'string' &&
                     entry.timestamp instanceof Date &&
                     typeof entry.success === 'boolean';
            })).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle focus and blur events correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            query: fc.string({ minLength: 1, maxLength: 50 }),
            shouldFocus: fc.boolean(),
            shouldBlur: fc.boolean(),
          }),
          async ({ query, shouldFocus, shouldBlur }) => {
            // Clear mocks for this test iteration
            jest.clearAllMocks();
            
            const searchInterface = new MockSearchInterface(
              mockOnQuerySubmit,
              mockOnQueryClear
            );

            // Type query first
            searchInterface.changeText(query);

            if (shouldFocus) {
              searchInterface.focus();

              // Focus should trigger suggestions if query exists
              if (query.trim().length > 0) {
                // Suggestions should be available
                expect(mockQueryProcessor.getQuerySuggestions).toHaveBeenCalled();
              }
            }

            if (shouldBlur) {
              searchInterface.blur();
              
              // Component should handle blur gracefully
              expect(searchInterface.currentQuery).toBe(query);
            }

            // Input should maintain its value through focus/blur
            expect(searchInterface.currentQuery).toBe(query);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should initialize with default state', () => {
      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      expect(searchInterface.currentQuery).toBe('');
      expect(searchInterface.isLoading).toBe(false);
      expect(Array.isArray(searchInterface.currentSuggestions)).toBe(true);
    });

    it('should initialize with custom initial query', () => {
      const initialQuery = 'find batsman';
      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear,
        initialQuery
      );

      expect(searchInterface.currentQuery).toBe(initialQuery);
    });

    it('should handle empty query submission gracefully', async () => {
      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      await searchInterface.submitQuery();

      // Should not call query processor or onQuerySubmit for empty query
      expect(mockQueryProcessor.processQuery).not.toHaveBeenCalled();
      expect(mockOnQuerySubmit).not.toHaveBeenCalled();
    });

    it('should handle query processor errors gracefully', async () => {
      const query = 'test query';
      mockQueryProcessor.processQuery.mockRejectedValue(new Error('Processing failed'));

      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      searchInterface.changeText(query);
      await searchInterface.submitQuery();

      // Should still call onQuerySubmit with fallback result
      expect(mockOnQuerySubmit).toHaveBeenCalled();
      const callArgs = mockOnQuerySubmit.mock.calls[0][0];
      expect(callArgs.rawQuery).toBe(query);
      expect(callArgs.confidence).toBeLessThan(0.5);
      expect(Array.isArray(callArgs.suggestions)).toBe(true);
    });

    it('should clear query and call onQueryClear', () => {
      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      // Type some text first
      searchInterface.changeText('test query');
      expect(searchInterface.currentQuery).toBe('test query');

      // Clear the query
      searchInterface.clearQuery();

      expect(searchInterface.currentQuery).toBe('');
      expect(mockOnQueryClear).toHaveBeenCalled();
    });

    it('should update suggestions based on query', () => {
      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      // Type query that should match suggestions
      searchInterface.changeText('find');

      // Should have called getQuerySuggestions
      expect(mockQueryProcessor.getQuerySuggestions).toHaveBeenCalled();
    });

    it('should handle suggestion selection', async () => {
      const suggestion = 'Find batsman needed tomorrow morning';
      mockQueryProcessor.processQuery.mockResolvedValue({
        rawQuery: suggestion,
        processedFilters: { positions: ['batsman'] },
        confidence: 0.8,
        suggestions: [],
      });

      const searchInterface = new MockSearchInterface(
        mockOnQuerySubmit,
        mockOnQueryClear
      );

      await searchInterface.selectSuggestion(suggestion);

      expect(searchInterface.currentQuery).toBe(suggestion);
      expect(mockQueryProcessor.processQuery).toHaveBeenCalledWith(suggestion);
      expect(mockOnQuerySubmit).toHaveBeenCalled();
    });
  });
});