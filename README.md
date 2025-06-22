# MyCoach App

A React Native app built with Expo for personal coaching use.

## Features

- Two-screen navigation structure (easily extensible)
- API service module for replicating cURL requests
- Clean, modern UI with React Navigation
- Ready for custom screen implementations

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
├── App.js                    # Main app component with navigation
├── src/
│   ├── screens/
│   │   ├── HomeScreen.js     # Home screen component
│   │   └── SecondScreen.js   # Second screen component
│   └── services/
│       └── apiService.js     # API service for cURL-like requests
├── package.json
└── README.md
```

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
