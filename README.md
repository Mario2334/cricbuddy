# MyCoach App

A React Native app built with Expo for personal coaching use.

## Features

- Five-tab navigation structure with bottom tabs
- API service module for replicating cURL requests
- Clean, modern UI with React Navigation
- **AI-Powered Cricket Coach Assistant** - Chat with an AI coach that has knowledge of your team data
- Match tracking and team management
- Calendar integration for match scheduling
- Player statistics and performance tracking

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Expo CLI or Expo Go app on your device

### Installation

1. Navigate to the project directory:
   ```bash
   cd mycoach
   ```

2. Install dependencies (already done during setup):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS device/simulator
- `npm run web` - Run in web browser

## Project Structure

```
mycoach/
├── App.tsx                   # Main app component with bottom tab navigation
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx    # Home screen with match listings
│   │   ├── StatsScreen.tsx   # Player statistics screen
│   │   ├── MyTeamScreen.tsx  # Team management screen
│   │   ├── CalendarScreen.tsx # Match calendar screen
│   │   ├── ChatbotScreen.tsx # AI Coach Assistant chatbot
│   │   └── MatchDetailScreen.tsx # Match details and scorecard
│   ├── services/
│   │   ├── apiService.ts     # API service for cricket data
│   │   └── googleMapsService.ts # Google Maps integration
│   ├── types/
│   │   ├── navigation.ts     # Navigation type definitions
│   │   ├── Match.ts          # Match data types
│   │   └── Ground.ts         # Ground data types
│   ├── utils/
│   │   └── matchUtils.ts     # Match utility functions
│   └── components/
│       └── MatchCalendar.tsx # Calendar component
├── .env.example              # Environment variables template
├── package.json
└── README.md
```

## Google Maps Configuration

This app uses `react-native-maps` with Google Maps provider for iOS. To enable Google Maps functionality:

1. **Get a Google Maps API Key:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "Maps SDK for iOS" API
   - Create credentials (API Key)
   - Restrict the API key to iOS apps (recommended for security)

2. **Configure the API Key:**
   - Open `app.json`
   - Add your Google Maps API key to the iOS configuration:
   ```json
   "ios": {
     "supportsTablet": true,
     "bundleIdentifier": "com.sanket.django.cricbuddy",
     "infoPlist": {
       "ITSAppUsesNonExemptEncryption": false
     },
     "config": {
       "googleMapsApiKey": "YOUR_ACTUAL_API_KEY_HERE"
     }
   }
   ```

3. **Rebuild the app:**
   ```bash
   expo prebuild --clean
   ```

**Note:** The Google Maps API key is required for the map functionality to work on iOS devices.

## AI Coach Assistant (Chatbot)

The app now includes an AI-powered cricket coach assistant that can provide personalized advice based on your team's data. The chatbot uses OpenRouter's API to access advanced AI models like Claude-3-Haiku.

### Features

- **Team-Aware Conversations**: The AI has access to your team's recent matches, player statistics, and performance data
- **Cricket Expertise**: Specialized in cricket coaching, strategy, and player development
- **Real-time Chat Interface**: Modern chat UI with message history and typing indicators
- **Contextual Advice**: Provides specific recommendations based on your team's actual performance

### Setup Instructions

1. **Get an OpenRouter API Key:**
   - Visit [OpenRouter.ai](https://openrouter.ai/)
   - Create an account and generate an API key
   - Note: OpenRouter provides access to multiple AI models with competitive pricing

2. **Configure the API Key:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and replace `your_openrouter_api_key_here` with your actual API key:
     ```
     OPENROUTER_API_KEY=your_actual_api_key_here
     ```

3. **Usage:**
   - Open the app and navigate to the "Coach Assistant" tab (chat bubble icon)
   - Start chatting with questions like:
     - "How did we perform in our last match?"
     - "What areas should our team focus on improving?"
     - "Give me a strategy for our upcoming match"
     - "Analyze our batting performance"

### Supported AI Models

The chatbot currently uses `anthropic/claude-3-haiku` for fast, intelligent responses. You can modify the model in `src/screens/ChatbotScreen.tsx` if needed.

## API Service

The `apiService.js` module is designed to replicate cURL requests with the same parameters, headers, and cookies. It includes:

- `makeRequest(config)` - Make API calls with custom configuration
- `parseCurlCommand(curlCommand)` - Convert cURL commands to request config
- Support for headers, cookies, and request bodies

## Adding New Screens

1. Create a new screen component in `src/screens/`
2. Import and add the screen to the Stack Navigator in `App.js`
3. Update navigation calls in existing screens as needed

## Next Steps

- Provide screen descriptions for custom UI implementation
- Share cURL requests for API integration
- Add specific functionality as needed
