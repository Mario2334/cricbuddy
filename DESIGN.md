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
Each major tab (except Stats) has its own native stack (`@react-navigation/native-stack`) to handle drill-down navigation (e.g., viewing match details). Tabs and stack screens use `freezeOnBlur`, so screens that aren't on show don't re-render. List screens record the tapped `Match` in `src/utils/matchRegistry.ts`, so MatchDetail renders straight away.

#### **HomeStack**
- **HomeList** (`HomeScreen`): List of matches.
- **MatchDetail** (`MatchDetailScreen`): Detailed scorecard view.

#### **MyTeamStack**
- **MyTeamList** (`MyTeamScreen`): List of team members/details.
- **MatchDetail** (`MatchDetailScreen`): Accessible here for context.

#### **CalendarStack**
- **CalendarList** (`CalendarScreen`): Week strip, month grid and day agenda; add matches from a CricHeroes link with a local date/time picker.
- **MatchDetail** (`MatchDetailScreen`): Quick access to scheduled match details.

### 5.3 Design System: "Vibrant Glass"
A modern light theme: a soft emerald / teal / lime mesh behind frosted-glass surfaces, gradient accents and duotone icons.
- **Tokens** (`src/theme/`):
  - `colors` (slate inks, emerald primary, lime accent), `statusColors`.
  - `glass` (frost fills, rims, hairlines), `mesh` (background blobs), `tones` (emerald, teal, sky, violet, amber, rose, lime, slate gradients for icon tiles), `gradients`.
  - Layered soft `shadows` plus coloured `glows`, `radii` with `squircle()` / `curve`.
  - Near-critically damped `springs` (press, release, snappy, gentle, sheet) and `easings`.
  - The legacy colour-named `palette` keys are remapped to the new hues and marked deprecated.
- **Fonts**: Space Grotesk (display, numbers) and Inter (body). Only the 7 weights used are loaded (`fontAssets.ts`). All text goes through `src/ui/AppText`; never combine `fontWeight` with a custom family.
- **Icons**: Phosphor (duotone by default) through the semantic registry in `src/ui/icons.ts`, rendered by `Icon` or the glossy gradient `IconTile`. Import icons one per file (`phosphor-react-native/src/icons/<Name>`); ESLint blocks value imports from the package root, which would bundle every icon. No emoji in UI chrome.
- **Surfaces**:
  - `GlassView` uses real blur on iOS only where safe: tab bar, sheets, compact header.
  - Elsewhere (list rows, anything whose ancestor animates opacity, Android) it uses translucent frost.
  - With Reduce Transparency on, surfaces go solid.
  - `MeshBackground` sits behind every screen. It is static, drawn once in a single memoized SVG: moving content behind a BlurView makes iOS re-blur every frame.
  - iOS draws `boxShadow` on the CPU and redraws it whenever a view's size changes. Never put one on a view whose size animates (move it with transforms). List rows use the single-layer `shadows.row`.
- **UI kit** (`src/ui/`): `PlayCard`, `Button` (gradient pill with glow), `Chip`, `DateBadge`, `StatusDateChip` ("Upcoming · Tomorrow 7:00 AM"), `WeekStrip`, `TodayHero`, `CountdownTiles`, `SegmentedTabs` (+ adapters), `BottomSheet`, `EmptyState`, `Skeleton`, `Confetti`, `AnimatedNumber`, `PlayToast`, `FAB`, `PullBall`, `GradientText`, and a collapsing `ScreenHeader` with `CompactHeaderBar`.
- **Navigation shell** (`src/navigation/`): a frosted floating tab bar whose glowing gradient indicator glides between tabs, and whose icons cross-fade from outline to filled. Screens draw their own headers. The tab bar hides on MatchDetail. Lists pad their bottom with `useTabBarSpace()`.
- **Dates** (`src/utils/dates.ts`): every date in the UI is formatted here with date-fns, in local time. `useNow()` re-renders on an interval, rolls over at midnight, and only ticks while its screen is focused and the app is in the foreground.
- **Motion**: Reanimated on the UI thread, haptics on interactions, staggered list entrances (first 8 items), confetti for celebrations. `useReducedMotion()` is respected everywhere.
  - Idle (ambient) loops go through `useAmbientLoop` (`src/hooks/useScreenActivity.ts`). They run only while the screen is focused and the app is active, driven by listeners so they also stop on frozen screens.
  - Decorative loops are finite: the ball bounces 3 times per visit, the FAB breathes twice, and the today ring and empty state run 3 cycles. Live pulses and spinners loop only while on screen.
- **Live scorecards** (`src/screens/match-detail/`): status comes from `detectMatchStatus`, in this order: the API status, then a result, then the innings with a 12h recency guard. Polling (30s) runs only while the match is live, on the Scorecard tab, focused and in the foreground. Refreshes are silent, skip unchanged data, and keep unchanged innings objects.
- **Match links**: `buildCricHeroesMatchUrl` (`src/utils/matchLinks.ts`) is the single source of the public scorecard URL.
  - Match cards have a link `IconButton`, and long-press copies.
  - The Today hero blocks copy on long-press.
  - MatchDetail has a link button in the hero and in the Share card.
- **Production builds** strip `console.log` (`babel-plugin-transform-remove-console`, production env only).

## 6. Security & Authentication
- **Headers**: identifying headers (`api-key`, `udid`, `authorization`) are sent with requests.
- **Cookies**: Session cookies are managed within the service for authenticated endpoints.

## 7. Future Roadmap / Pending Tasks
- **Dark theme**: a "Midnight Neon" variant of the Vibrant Glass tokens.
- **Offline Support**: Better caching or offline-first architecture using AsyncStorage.
