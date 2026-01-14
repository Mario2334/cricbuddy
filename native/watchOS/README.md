# CricBuddy watchOS Companion App

This directory contains the native watchOS companion app for CricBuddy. These files are stored outside the `ios/` folder to prevent deletion during Expo prebuild.

## Setup Instructions

### 1. Add watchOS Target in Xcode

1. Open `ios/CricBuddy.xcworkspace` in Xcode
2. Go to **File > New > Target**
3. Select **watchOS > App** and click Next
4. Configure:
   - Product Name: `CricBuddyWatch`
   - Bundle Identifier: `com.sanket.django.cricbuddy.watchkitapp`
   - Language: Swift
   - User Interface: SwiftUI
   - Uncheck "Include Notification Scene"
5. Click Finish

### 2. Copy Source Files

Copy all files from `native/watchOS/CricBuddyWatch/` to the newly created `ios/CricBuddyWatch/` target:

```bash
cp -r native/watchOS/CricBuddyWatch/* ios/CricBuddyWatch/
```

### 3. Configure Build Settings

In Xcode, select the CricBuddyWatch target and configure in Build Settings:
- **Info.plist File**: Leave empty (Xcode generates automatically)
- **Product Bundle Identifier**: `com.sanket.django.cricbuddy.watchkitapp`

Then in the Info tab, add these keys:
- `NSHealthShareUsageDescription`: "CricBuddy needs access to your health data to track workout metrics."
- `NSHealthUpdateUsageDescription`: "CricBuddy needs to save your workout data to Apple Health."
- `WKCompanionAppBundleIdentifier`: `com.sanket.django.cricbuddy`

### 4. Configure Capabilities

In Xcode, select the CricBuddyWatch target and add:
- **HealthKit** capability
- **Background Modes** with "Workout processing" enabled

### 5. Update iOS App Entitlements

Add Watch Connectivity to the main iOS app's entitlements if not already present.

### 6. Build and Run

1. Select the CricBuddyWatch scheme
2. Choose your Apple Watch simulator or device
3. Build and run

## File Structure

```
native/watchOS/CricBuddyWatch/
├── CricBuddyWatchApp.swift      # App entry point
├── ContentView.swift             # Main view (idle/workout switch)
├── WorkoutView.swift             # Active workout UI
├── WatchWorkoutManager.swift     # HealthKit workout session
├── WatchConnectivityManager.swift # iPhone communication
├── OfflineSyncManager.swift      # Offline data sync
├── CricBuddyWatch.entitlements   # HealthKit entitlements
└── Assets.xcassets/              # App icons and colors
```

**Note:** Info.plist is NOT included - Xcode generates it automatically. Configure app settings via Build Settings instead.

## Features

- Real-time heart rate display during workouts
- Elapsed time and calorie tracking
- Set completion via tap gesture
- End workout via long-press gesture
- Offline data queuing when iPhone is unreachable
- Automatic sync when connectivity is restored
