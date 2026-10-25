# Looking For Feed Feature

This directory contains the implementation of the Looking For feed feature for the cricket app.

## Directory Structure

```
src/features/looking-for-feed/
├── __tests__/          # Test files
├── components/         # React Native components
├── hooks/             # Custom React hooks
├── services/          # API clients and external services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── README.md          # This file
```

## Core Types

The feature uses the following main TypeScript interfaces:

- `RecruitmentPost` - Main data structure for cricket recruitment posts
- `UserInfo` - User profile information
- `TeamRequirements` - Team/player requirements
- `MatchDetails` - Match-specific information
- `LocationData` - Geographic location data
- `TimingInfo` - Scheduling and timing information
- `AIQuery` - AI-powered query processing
- `PostFilters` - Filtering criteria for posts
- `OpenRouterConfig` - AI service configuration

## Testing

The feature uses:
- **Jest** for unit testing framework
- **React Native Testing Library** for component testing
- **fast-check** for property-based testing

Run tests with:
```bash
npm test -- --testPathPatterns="looking-for-feed"
```

## Development

This feature integrates with:
- CricHeroes API for recruitment post data
- OpenRouter API for AI-powered natural language processing
- React Native navigation system
- Existing app components and styling