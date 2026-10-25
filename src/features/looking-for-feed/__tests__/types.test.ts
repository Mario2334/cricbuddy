import * as fc from 'fast-check';
import {
  RecruitmentPost,
  UserInfo,
  TeamRequirements,
  MatchDetails,
  LocationData,
  TimingInfo,
  AIQuery,
  PostFilters,
  SkillLevel,
  TeamType,
  BallType,
  GroundType,
  MatchFormat,
  ModelConfig,
  OpenRouterConfig,
} from '../types';

describe('Looking For Feed Types', () => {
  describe('Type Structure Validation', () => {
    it('should create valid UserInfo objects', () => {
      const userInfo: UserInfo = {
        id: 'user123',
        name: 'John Doe',
        profilePhoto: 'https://example.com/photo.jpg',
        contactDetails: {
          phone: '+1234567890',
          email: 'john@example.com',
        },
        rating: 4.5,
      };

      expect(userInfo.id).toBe('user123');
      expect(userInfo.name).toBe('John Doe');
      expect(userInfo.contactDetails.phone).toBe('+1234567890');
    });

    it('should create valid TeamRequirements objects', () => {
      const teamReq: TeamRequirements = {
        positionsNeeded: ['batsman', 'bowler'],
        skillLevel: SkillLevel.INTERMEDIATE,
        teamType: TeamType.COMPETITIVE,
        description: 'Looking for experienced players',
      };

      expect(teamReq.positionsNeeded).toContain('batsman');
      expect(teamReq.skillLevel).toBe(SkillLevel.INTERMEDIATE);
    });

    it('should create valid RecruitmentPost objects', () => {
      const post: RecruitmentPost = {
        id: 'post123',
        user: {
          id: 'user123',
          name: 'John Doe',
          profilePhoto: 'https://example.com/photo.jpg',
          contactDetails: { phone: '+1234567890' },
        },
        requirements: {
          positionsNeeded: ['batsman'],
          skillLevel: SkillLevel.INTERMEDIATE,
          teamType: TeamType.COMPETITIVE,
          description: 'Need batsman',
        },
        matchDetails: {
          ballType: BallType.LEATHER,
          groundType: GroundType.TURF,
          matchFormat: MatchFormat.T20,
          comments: 'Friendly match',
        },
        location: {
          latitude: 12.9716,
          longitude: 77.5946,
          cityId: 1,
          cityName: 'Bangalore',
        },
        timing: {
          isLongTerm: false,
          preferredTimes: [{ startTime: '09:00', endTime: '12:00' }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(post.id).toBe('post123');
      expect(post.user.name).toBe('John Doe');
      expect(post.requirements.positionsNeeded).toContain('batsman');
    });
  });

  describe('Property-Based Tests', () => {
    it('should validate AIQuery structure with fast-check', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (rawQuery, confidence) => {
            const aiQuery: AIQuery = {
              rawQuery,
              processedFilters: {},
              confidence,
              modelUsed: 'gpt-oss-120b',
              fallbackAttempts: 0,
            };

            expect(aiQuery.rawQuery).toBe(rawQuery);
            expect(aiQuery.confidence).toBe(confidence);
            expect(aiQuery.confidence).toBeGreaterThanOrEqual(0);
            expect(aiQuery.confidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate ModelConfig structure with fast-check', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (id, name, priority, maxRetries) => {
            const modelConfig: ModelConfig = {
              id,
              name,
              priority,
              maxRetries,
            };

            expect(modelConfig.id).toBe(id);
            expect(modelConfig.name).toBe(name);
            expect(modelConfig.priority).toBeGreaterThan(0);
            expect(modelConfig.maxRetries).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate OpenRouterConfig structure with fast-check', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.webUrl(),
          (apiKey, baseUrl) => {
            const config: OpenRouterConfig = {
              apiKey,
              baseUrl,
              models: [
                {
                  id: 'gpt-oss-120b',
                  name: 'GPT OSS 120B',
                  priority: 1,
                  maxRetries: 3,
                },
              ],
            };

            expect(config.apiKey).toBe(apiKey);
            expect(config.baseUrl).toBe(baseUrl);
            expect(config.models).toHaveLength(1);
            expect(config.models[0].id).toBe('gpt-oss-120b');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});