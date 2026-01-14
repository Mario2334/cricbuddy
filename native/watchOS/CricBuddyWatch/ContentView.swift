import SwiftUI

/// Main content view that switches between idle and workout states
struct ContentView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager
    @EnvironmentObject var connectivityManager: WatchConnectivityManager
    
    var body: some View {
        Group {
            if workoutManager.isWorkoutActive {
                WorkoutView()
            } else {
                IdleView()
            }
        }
        .onAppear {
            connectivityManager.activate()
        }
    }
}

/// View shown when no workout is active
struct IdleView: View {
    @EnvironmentObject var connectivityManager: WatchConnectivityManager
    @EnvironmentObject var workoutManager: WatchWorkoutManager
    @State private var showStartWorkoutConfirmation = false
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 40))
                .foregroundColor(.green)
            
            Text("CricBuddy")
                .font(.headline)
            
            Text(connectivityManager.isReachable ? 
                 "Ready to sync with iPhone" : 
                 "Start a workout on your iPhone")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            // Connection status indicator
            HStack(spacing: 8) {
                Circle()
                    .fill(connectivityManager.isReachable ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(connectivityManager.isReachable ? "Connected" : "Waiting...")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            // Manual start workout button (for standalone mode)
            if !connectivityManager.isReachable {
                Button(action: {
                    showStartWorkoutConfirmation = true
                }) {
                    HStack {
                        Image(systemName: "play.fill")
                        Text("Start")
                            .font(.caption)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.green)
                    .cornerRadius(20)
                }
                .buttonStyle(PlainButtonStyle())
                .padding(.top, 8)
            }
        }
        .padding()
        .confirmationDialog(
            "Start Workout?",
            isPresented: $showStartWorkoutConfirmation,
            titleVisibility: .visible
        ) {
            Button("Start Workout") {
                Task {
                    await workoutManager.startWorkout(
                        exerciseName: "Workout",
                        setIndex: 0,
                        totalSets: 0
                    )
                }
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchWorkoutManager.shared)
        .environmentObject(WatchConnectivityManager.shared)
}
