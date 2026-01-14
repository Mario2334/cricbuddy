# MyCoach (CricHeroes Super) - Design Document

## 1. Executive Summary
MyCoach is a React Native mobile application built with Expo, designed to help cricket coaches and players manage their schedules, view match details, and track statistics. It integrates with the CricHeroes ecosystem to fetch real-time match data, scorecards, and player stats.

## 2. Architecture Overview
The application follows a modular architecture using React Native with TypeScript.

- **Framework**: React Native (Expo SDK 53)
- **Language**: TypeScript
- **Navigation**: React Navigation v7
- **State Management**: Local state (useState/useReducer) combined with a Service-layer caching strategy.
- **Styling**: Standard React Native StyleSheet.
- **Maps Integration**: `react-native-maps` for ground locations.

### Key Libraries
- `expo-calendar`: Integration with device calendar for scheduling.
- `react-native-reanimated`: For fluid animations.
- `react-native-pager-view`: For swiping views.
- `react-native-async-storage`: For persisting simple data.

## 3. Data Layer

### 3.1 Data Entities
The core data models are defined in `src/types`:

- **Match**: Central entity containing teams, venue, status (upcoming/live/past), and summary scores.
- **MatchSummary**: Detailed breakdown of the match result.
- **TeamInnings**: Inning-by-inning details including runs, wickets, and overs.
- **Ground**: Venue details, location (lat/long), facilities, and booking info.
- **ScheduledMatch**: A simplified match object used for calendar integration.

### 3.2 API & Service Layer (`src/services/apiService.ts`)
The application communicates with the CricHeroes API via a centralized `ApiService` class.

- **Throttling & Rate Limiting**: Implements client-side throttling (500ms min interval) and handles `429` responses.
- **Caching**: Custom in-memory `requestCache` with configurable expiry (default 30s for lists, 15s for scorecards).
- **Unified Fetching**: `_getMatchesUnified` fetches data once and serves both "Upcoming" and "Live" views.
- **Endpoints**:
    - `get-my-web-Matches`: Fetches match lists.
    - `get-scorecard`: Fetches detailed match data.
    - `get-player-statistic`: Fetches player performance stats.

## 4. Feature Modules (Screens)

### 4.1 Home Screen
- **Function**: The main dashboard.
- **Key Features**: Displaying upcoming matches, quick access to live scores.

### 4.2 Calendar Screen (`CalendarScreen.tsx`)
- **Function**: Scheduling and time management.
- **Features**:
    - Visual calendar interface.
    - Syncing matches to device calendar.
    - Managing practice sessions or match dates.

### 4.3 Match Detail Screen (`MatchDetailScreen.tsx`)
- **Function**: Deep dive into a specific match.
- **Features**:
    - Comprehensive scorecard.
    - Ball-by-ball or over-by-over summary.
    - Player info (Captain, Wicket Keeper).
    - Squads and playing XI.

### 4.4 My Team (`MyTeamScreen.tsx`)
- **Function**: Team management.
- **Features**: Viewing squad members and team stats.

### 4.5 Statistics (`StatsScreen.tsx`)
- **Function**: Performance tracking.
- **Features**: Player stats (batting/bowling averages).

## 5. User Interface & Navigation
The application uses a nested navigation structure managed by `React Navigation v7`.

### 5.1 Root Navigator (Bottom Tabs)
The main entry point is a Bottom Tab Navigator allowing quick access to core features:

| Tab Name | Icon (Active/Inactive) | Target Stack/Screen | Description |
| :--- | :--- | :--- | :--- |
| **Home** | `home` / `home-outline` | `HomeStack` | Dashboard for matches. |
| **Stats** | `stats-chart` / `stats-chart-outline` | `StatsScreen` | Individual player statistics. |
| **My Team** | `people` / `people-outline` | `MyTeamStack` | Team management view. |
| **Calendar** | `calendar` / `calendar-outline` | `CalendarStack` | Schedule and planner. |

### 5.2 Stack Navigators
Each major tab (except Stats) has its own Stack Navigator to handle drill-down navigation (e.g., viewing match details).

#### **HomeStack**
- **HomeList** (`HomeScreen`): List of matches.
- **MatchDetail** (`MatchDetailScreen`): Detailed scorecard view.

#### **MyTeamStack**
- **MyTeamList** (`MyTeamScreen`): List of team members/details.
- **MatchDetail** (`MatchDetailScreen`): Accessible here for context.

#### **CalendarStack**
- **CalendarList** (`CalendarScreen`): Monthly/Weekly calendar view.
- **MatchDetail** (`MatchDetailScreen`): Quick access to scheduled match details.

### 5.3 Global UI Elements
- **Header**: Consistent branding color (`#0066cc`) with white text.
- **Toast Messages**: Integrated `react-native-toast-message` for user feedback.

## 6. Security & Authentication
- **Headers**: identifying headers (`api-key`, `udid`, `authorization`) are sent with requests.
- **Cookies**: Session cookies are managed within the service for authenticated endpoints.

## 7. Future Roadmap / Pending Tasks
- **Fix Calendar Sync**: Resolve issues with matches appearing on wrong dates.
- **UI Polish**: Enhance "Midnight Glass" aesthetic or similar premium themes if requested.
- **Offline Support**: Better caching or offline-first architecture using AsyncStorage.
