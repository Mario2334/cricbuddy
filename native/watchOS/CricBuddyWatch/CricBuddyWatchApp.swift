import SwiftUI
import WatchConnectivity
import HealthKit

/// Main entry point for the CricBuddy watchOS companion app
@main
struct CricBuddyWatchApp: App {
    @StateObject private var workoutManager = WatchWorkoutManager.shared
    @StateObject private var connectivityManager = WatchConnectivityManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutManager)
                .environmentObject(connectivityManager)
        }
    }
}
