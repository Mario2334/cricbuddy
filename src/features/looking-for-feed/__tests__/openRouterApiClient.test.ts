import * as fc from 'fast-check';
import { OpenRouterApiClient, OpenRouterResponse } from '../services/openRouterApiClient';

// Mock fetch
const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

// Mock environment variable
const originalEnv = process.env;

describe('OpenRouter API Client', () => {
  let apiClient: OpenRouterApiClient;

  beforeEach(() => {
    // Set up environment
    process.env = {
      ...originalEnv,
      OPENROUTER_API_KEY: 'test-api-key-12345'
    };
    
    apiClient = new OpenRouterApiClient();
    mockFetch.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 10: API client request formatting (AI)
     * **Validates: Requirements 4.3**
     * 
     * For any natural language query input, the OpenRouter API client should format
     * requests with correct endpoints, authentication headers, and request structure.
     */
    it('Property 10: API client request formatting (AI)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0), // Valid non-empty queries only
          async (query) => {
            // Mock successful response from OpenRouter
            const mockResponse = {
              ok: true,
              status: 200,
              json: jest.fn().mockResolvedValue({
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: Date.now(),
                model: 'openai/gpt-4o-mini',
                choices: [{
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      filters: {
                        positions: ['batsman'],
                        dates: { startDate: '2024-01-15', endDate: '2024-01-15' },
                        times: { startTime: '09:00', endTime: '12:00' }
                      },
                      confidence: 0.8,
                      suggestions: ['Try being more specific']
                    })
                  },
                  finish_reason: 'stop'
                }],
                usage: {
                  prompt_tokens: 100,
                  completion_tokens: 50,
                  total_tokens: 150
                }
              })
            };
            mockFetch.mockResolvedValue(mockResponse as any);

            // Process the query
            await apiClient.processQuery(query);

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalledTimes(1);
            
            const [url, options] = mockFetch.mock.calls[0];

            // Verify URL structure
            expect(typeof url).toBe('string');
            expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');

            // Verify request options
            expect(options).toBeDefined();
            if (options) {
              expect(options.method).toBe('POST');
              expect(options.headers).toBeDefined();

              // Verify required authentication headers
              const headers = options.headers as Record<string, string>;
              expect(headers['Authorization']).toBe('Bearer test-api-key-12345');
              expect(headers['Content-Type']).toBe('application/json');
              expect(headers['HTTP-Referer']).toBe('https://cricheroes.com');
              expect(headers['X-Title']).toBe('CricBuddy Looking For Feed');

              // Verify request body structure
              expect(options.body).toBeDefined();
              const body = JSON.parse(options.body);
              
              expect(body.model).toBeDefined();
              expect(typeof body.model).toBe('string');
              expect(body.model.length).toBeGreaterThan(0);
              
              expect(Array.isArray(body.messages)).toBe(true);
              expect(body.messages.length).toBeGreaterThanOrEqual(2);
              
              // Verify system message
              const systemMessage = body.messages.find((msg: any) => msg.role === 'system');
              expect(systemMessage).toBeDefined();
              expect(systemMessage.content).toContain('cricket recruitment posts');
              
              // Verify user message contains the query
              const userMessage = body.messages.find((msg: any) => msg.role === 'user');
              expect(userMessage).toBeDefined();
              expect(userMessage.content).toBe(query);
              
              // Verify request parameters
              expect(typeof body.temperature).toBe('number');
              expect(body.temperature).toBeGreaterThanOrEqual(0);
              expect(body.temperature).toBeLessThanOrEqual(1);
              
              expect(typeof body.max_tokens).toBe('number');
              expect(body.max_tokens).toBeGreaterThan(0);
              
              expect(typeof body.top_p).toBe('number');
              expect(body.top_p).toBeGreaterThanOrEqual(0);
              expect(body.top_p).toBeLessThanOrEqual(1);
            }

            // Clear mock for next iteration
            mockFetch.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle model fallback correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (query) => {
            // Mock first model failure, second model success
            let callCount = 0;
            mockFetch.mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First model fails
                return Promise.resolve({
                  ok: false,
                  status: 429,
                  json: jest.fn().mockResolvedValue({
                    error: { message: 'Rate limit exceeded', type: 'rate_limit_error' }
                  })
                } as any);
              } else {
                // Second model succeeds
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: jest.fn().mockResolvedValue({
                    id: 'chatcmpl-test',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'qwen/qwen-2.5-72b-instruct',
                    choices: [{
                      index: 0,
                      message: {
                        role: 'assistant',
                        content: JSON.stringify({
                          filters: {},
                          confidence: 0.5,
                          suggestions: ['Try being more specific']
                        })
                      },
                      finish_reason: 'stop'
                    }]
                  })
                } as any);
              }
            });

            const result = await apiClient.processQuery(query);

            // Should succeed with fallback
            expect(result.success).toBe(true);
            expect(result.fallbackAttempts).toBeGreaterThan(0);
            expect(result.modelUsed).toBeDefined();

            // Should have made multiple requests (fallback)
            expect(mockFetch).toHaveBeenCalledTimes(2);

            mockFetch.mockClear();
          }
        ),
        { numRuns: 10 } // Fewer runs for fallback tests
      );
    }, 30000); // 30 second timeout

    it('should handle authentication errors correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (query) => {
            // Mock authentication error
            mockFetch.mockResolvedValue({
              ok: false,
              status: 401,
              json: jest.fn().mockResolvedValue({
                error: { message: 'Invalid API key', type: 'authentication_error' }
              })
            } as any);

            const result = await apiClient.processQuery(query);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Authentication failed');

            mockFetch.mockClear();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should parse AI responses correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }), // rawQuery
          fc.oneof(
            // Valid AI response structure
            fc.record({
              id: fc.string(),
              object: fc.constant('chat.completion'),
              created: fc.integer(),
              model: fc.string(),
              choices: fc.array(
                fc.record({
                  index: fc.integer(),
                  message: fc.record({
                    role: fc.constant('assistant'),
                    content: fc.oneof(
                      // Valid JSON response
                      fc.record({
                        filters: fc.record({
                          positions: fc.option(fc.array(fc.constantFrom('batsman', 'bowler', 'wicket-keeper', 'all-rounder'))),
                          dates: fc.option(fc.record({
                            startDate: fc.date().map(d => d.toISOString().split('T')[0]),
                            endDate: fc.date().map(d => d.toISOString().split('T')[0])
                          })),
                          times: fc.option(fc.record({
                            startTime: fc.constantFrom('06:00', '09:00', '14:00', '18:00'),
                            endTime: fc.constantFrom('12:00', '15:00', '17:00', '22:00')
                          })),
                          locations: fc.option(fc.array(fc.string())),
                          skillLevels: fc.option(fc.array(fc.constantFrom('beginner', 'intermediate', 'advanced', 'professional')))
                        }),
                        confidence: fc.float({ min: 0, max: 1 }),
                        suggestions: fc.option(fc.array(fc.string()))
                      }).map(obj => JSON.stringify(obj)),
                      // Invalid JSON
                      fc.string()
                    )
                  }),
                  finish_reason: fc.string()
                }),
                { minLength: 1, maxLength: 1 }
              )
            }),
            // Invalid response structures
            fc.oneof(
              fc.record({ choices: fc.constant([]) }), // Empty choices
              fc.record({ choices: fc.array(fc.record({ message: fc.record({ content: fc.constant('') }) })) }), // Empty content
              fc.constant(null),
              fc.constant(undefined)
            )
          ),
          async (rawQuery, response) => {
            // Test the parseAIResponse method indirectly through processQuery
            // Since parseAIResponse is private, we test its behavior through the public API
            
            // Mock the response
            mockFetch.mockResolvedValue({
              ok: true,
              status: 200,
              json: jest.fn().mockResolvedValue(response)
            } as any);

            // The parsing should not throw errors and should return a valid AIQuery structure
            const result = await apiClient.processQuery(rawQuery);
            
            // Result should always have required fields
            expect(typeof result.success).toBe('boolean');
            
            if (result.success && result.data) {
              expect(result.data.rawQuery).toBe(rawQuery);
              expect(typeof result.data.confidence).toBe('number');
              expect(result.data.confidence).toBeGreaterThanOrEqual(0);
              expect(result.data.confidence).toBeLessThanOrEqual(1);
              expect(typeof result.data.processedFilters).toBe('object');
              expect(result.data.processedFilters).not.toBeNull();
              
              // Suggestions should be array if present
              if (result.data.suggestions) {
                expect(Array.isArray(result.data.suggestions)).toBe(true);
              }
            } else {
              expect(result.error).toBeDefined();
              expect(typeof result.error).toBe('string');
            }
            
            mockFetch.mockClear();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle network timeouts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (query) => {
            // Mock timeout by never resolving
            mockFetch.mockImplementation(() => 
              new Promise(() => {}) // Never resolves
            );

            const result = await apiClient.processQuery(query);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();

            mockFetch.mockClear();
          }
        ),
        { numRuns: 3, timeout: 35000 } // Fewer runs and longer timeout for network tests
      );
    }, 40000); // 40 second timeout for the test itself
  });

  describe('Unit Tests', () => {
    it('should create client with correct default configuration', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient.processQuery).toBeDefined();
      expect(apiClient.testConnection).toBeDefined();
      expect(apiClient.validateConfig).toBeDefined();
      expect(apiClient.getConfig).toBeDefined();
    });

    it('should validate configuration correctly', () => {
      const validation = apiClient.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should handle empty queries', async () => {
      const result = await apiClient.processQuery('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Query cannot be empty');
    });

    it('should handle whitespace-only queries', async () => {
      const result = await apiClient.processQuery('   ');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Query cannot be empty');
    });

    it('should return fallback response for invalid AI responses', async () => {
      // Mock invalid JSON response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: 'test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'test-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'invalid json {'
            },
            finish_reason: 'stop'
          }]
        })
      } as any);

      const result = await apiClient.processQuery('test query');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.confidence).toBe(0.1);
        expect(result.data.rawQuery).toBe('test query');
        expect(result.data.processedFilters).toEqual({});
        expect(Array.isArray(result.data.suggestions)).toBe(true);
        expect(result.data.suggestions!.length).toBeGreaterThan(0);
      }
    });

    it('should test connection successfully', async () => {
      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: 'test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'test-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                filters: {},
                confidence: 0.5,
                suggestions: []
              })
            },
            finish_reason: 'stop'
          }]
        })
      } as any);

      const result = await apiClient.testConnection();

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should handle configuration without API key', () => {
      const clientWithoutKey = new OpenRouterApiClient({ apiKey: '' });
      const validation = clientWithoutKey.validateConfig();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('OpenRouter API key is required');
    });

    it('should parse relative dates correctly', async () => {
      // Mock response with relative dates
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          id: 'test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'test-model',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                filters: {
                  dates: {
                    startDate: 'today',
                    endDate: 'tomorrow'
                  }
                },
                confidence: 0.8,
                suggestions: []
              })
            },
            finish_reason: 'stop'
          }]
        })
      } as any);

      const result = await apiClient.processQuery('find matches today and tomorrow');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data && result.data.processedFilters.dates) {
        expect(result.data.processedFilters.dates.startDate).toBeInstanceOf(Date);
        expect(result.data.processedFilters.dates.endDate).toBeInstanceOf(Date);
      }
    });
  });
});