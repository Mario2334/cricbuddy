import SwiftUI

// MARK: - Timer Types
enum TimerType: String, Codable {
    case exercise
    case rest
    case workout
}

enum TimerState: String, Codable {
    case created
    case running
    case paused
    case completed
    case stopped
}

enum WorkoutPhase: String, Codable {
    case warmup
    case strength
    case core
    case cooldown
    
    var theme: WorkoutTheme {
        switch self {
        case .warmup:
            return WorkoutTheme(
                primaryColor: Color(hex: "#F97316"),
                secondaryColor: Color(hex: "#FED7AA"),
                backgroundColor: Color(hex: "#1F2937"),
                textColor: Color(hex: "#F9FAFB"),
                accentColor: Color(hex: "#FB923C"),
                progressColor: Color(hex: "#F97316")
            )
        case .strength:
            return WorkoutTheme(
                primaryColor: Color(hex: "#3B82F6"),
                secondaryColor: Color(hex: "#BFDBFE"),
                backgroundColor: Color(hex: "#1F2937"),
                textColor: Color(hex: "#F9FAFB"),
                accentColor: Color(hex: "#60A5FA"),
                progressColor: Color(hex: "#3B82F6")
            )
        case .core:
            return WorkoutTheme(
                primaryColor: Color(hex: "#10B981"),
                secondaryColor: Color(hex: "#A7F3D0"),
                backgroundColor: Color(hex: "#1F2937"),
                textColor: Color(hex: "#F9FAFB"),
                accentColor: Color(hex: "#34D399"),
                progressColor: Color(hex: "#10B981")
            )
        case .cooldown:
            return WorkoutTheme(
                primaryColor: Color(hex: "#8B5CF6"),
                secondaryColor: Color(hex: "#C4B5FD"),
                backgroundColor: Color(hex: "#1F2937"),
                textColor: Color(hex: "#F9FAFB"),
                accentColor: Color(hex: "#A78BFA"),
                progressColor: Color(hex: "#8B5CF6")
            )
        }
    }
}

struct WorkoutTheme {
    let primaryColor: Color
    let secondaryColor: Color
    let backgroundColor: Color
    let textColor: Color
    let accentColor: Color
    let progressColor: Color
}

// MARK: - Color Extension for Hex
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

/// Main workout view displayed during an active workout session
/// Shows current exercise, heart rate, elapsed time, and provides controls
struct WorkoutView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager
    @EnvironmentObject var connectivityManager: WatchConnectivityManager
    
    @State private var showEndWorkoutConfirmation = false
    
    private var currentTheme: WorkoutTheme {
        workoutManager.currentPhase.theme
    }
    
    var body: some View {
        VStack(spacing: 6) {
            // Exercise Info with Phase Theme
            ExerciseInfoSection(
                exerciseName: workoutManager.currentExercise,
                currentSet: workoutManager.currentSetIndex,
                totalSets: workoutManager.totalSets,
                theme: currentTheme
            )
            
            // Active Timer Display (if any)
            if let activeTimer = workoutManager.activeTimer {
                TimerDisplaySection(
                    timer: activeTimer,
                    theme: currentTheme,
                    onPause: { workoutManager.pauseActiveTimer() },
                    onResume: { workoutManager.resumeActiveTimer() },
                    onSkip: { workoutManager.skipActiveTimer() },
                    onAdjust: { adjustment in workoutManager.adjustActiveTimer(by: adjustment) }
                )
            }
            
            Divider()
                .background(currentTheme.secondaryColor.opacity(0.3))
            
            // Heart Rate Display
            HeartRateSection(
                heartRate: workoutManager.currentHeartRate
            )
            
            // Elapsed Time
            ElapsedTimeSection(
                elapsedSeconds: workoutManager.elapsedSeconds,
                theme: currentTheme
            )
            
            // Calories
            CaloriesSection(
                calories: workoutManager.activeCalories
            )
            
            Spacer()
            
            // Set Complete Button
            SetCompleteButton(
                onTap: completeSet,
                theme: currentTheme
            )
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(currentTheme.backgroundColor)
        .onLongPressGesture(minimumDuration: 1.0) {
            showEndWorkoutConfirmation = true
        }
        .confirmationDialog(
            "End Workout?",
            isPresented: $showEndWorkoutConfirmation,
            titleVisibility: .visible
        ) {
            Button("End Workout", role: .destructive) {
                endWorkout()
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    
    // MARK: - Actions
    private func completeSet() {
        guard let exerciseId = workoutManager.currentExercise else { return }
        let setId = "set_\(workoutManager.currentSetIndex)"
        workoutManager.completeSet(exerciseId: exerciseId, setId: setId)
    }
    
    private func endWorkout() {
        Task {
            await workoutManager.endWorkout()
        }
    }
}

// MARK: - Timer Display Section
struct TimerDisplaySection: View {
    let timer: WatchTimer
    let theme: WorkoutTheme
    let onPause: () -> Void
    let onResume: () -> Void
    let onSkip: () -> Void
    let onAdjust: (Int) -> Void
    
    var body: some View {
        VStack(spacing: 4) {
            // Timer Type Label
            Text(timer.type == .rest ? "REST" : "EXERCISE")
                .font(.caption2)
                .foregroundColor(theme.secondaryColor)
            
            // Circular Progress with Time
            ZStack {
                // Background Circle
                Circle()
                    .stroke(theme.secondaryColor.opacity(0.3), lineWidth: 6)
                    .frame(width: 80, height: 80)
                
                // Progress Circle
                Circle()
                    .trim(from: 0, to: timer.progress)
                    .stroke(theme.progressColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .frame(width: 80, height: 80)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.1), value: timer.progress)
                
                // Time Display
                VStack(spacing: 0) {
                    Text(timer.displayTime)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(theme.textColor)
                    
                    if timer.type == .rest {
                        Text("remaining")
                            .font(.system(size: 8))
                            .foregroundColor(theme.secondaryColor)
                    }
                }
            }
            
            // Timer Controls
            HStack(spacing: 12) {
                if timer.type == .rest {
                    // -15s button
                    Button(action: { onAdjust(-15) }) {
                        Text("-15s")
                            .font(.caption2)
                            .foregroundColor(theme.textColor)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(theme.secondaryColor.opacity(0.3))
                            .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                
                // Pause/Resume button
                Button(action: timer.isActive ? onPause : onResume) {
                    Image(systemName: timer.isActive ? "pause.fill" : "play.fill")
                        .font(.system(size: 16))
                        .foregroundColor(theme.textColor)
                        .frame(width: 32, height: 32)
                        .background(theme.primaryColor)
                        .clipShape(Circle())
                }
                .buttonStyle(PlainButtonStyle())
                
                if timer.type == .rest {
                    // +15s button
                    Button(action: { onAdjust(15) }) {
                        Text("+15s")
                            .font(.caption2)
                            .foregroundColor(theme.textColor)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(theme.secondaryColor.opacity(0.3))
                            .cornerRadius(8)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                
                // Skip button
                Button(action: onSkip) {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 12))
                        .foregroundColor(theme.secondaryColor)
                        .frame(width: 28, height: 28)
                        .background(theme.secondaryColor.opacity(0.3))
                        .clipShape(Circle())
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Exercise Info Section
struct ExerciseInfoSection: View {
    let exerciseName: String?
    let currentSet: Int
    let totalSets: Int
    var theme: WorkoutTheme = WorkoutPhase.strength.theme
    
    var body: some View {
        VStack(spacing: 2) {
            Text(exerciseName ?? "Workout")
                .font(.headline)
                .foregroundColor(theme.textColor)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            
            if totalSets > 0 {
                Text("Set \(currentSet + 1) of \(totalSets)")
                    .font(.caption)
                    .foregroundColor(theme.secondaryColor)
            }
        }
    }
}

// MARK: - Heart Rate Section
struct HeartRateSection: View {
    let heartRate: Double?
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "heart.fill")
                .foregroundColor(.red)
                .font(.system(size: 16))
            
            if let hr = heartRate {
                Text("\(Int(hr))")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(.red)
                Text("BPM")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                Text("--")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(.secondary)
            }
        }
    }
}


// MARK: - Elapsed Time Section
struct ElapsedTimeSection: View {
    let elapsedSeconds: Int
    var theme: WorkoutTheme = WorkoutPhase.strength.theme
    
    var formattedTime: String {
        let hours = elapsedSeconds / 3600
        let minutes = (elapsedSeconds % 3600) / 60
        let seconds = elapsedSeconds % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%02d:%02d", minutes, seconds)
        }
    }
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "timer")
                .foregroundColor(theme.accentColor)
                .font(.system(size: 14))
            
            Text(formattedTime)
                .font(.system(size: 20, weight: .medium, design: .monospaced))
                .foregroundColor(theme.accentColor)
        }
    }
}

// MARK: - Calories Section
struct CaloriesSection: View {
    let calories: Double
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .foregroundColor(.orange)
                .font(.system(size: 14))
            
            Text("\(Int(calories))")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.orange)
            
            Text("CAL")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Set Complete Button
struct SetCompleteButton: View {
    let onTap: () -> Void
    var theme: WorkoutTheme = WorkoutPhase.strength.theme
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                Text("Complete Set")
                    .font(.caption)
            }
            .foregroundColor(theme.textColor)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(theme.primaryColor)
            .cornerRadius(20)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    WorkoutView()
        .environmentObject(WatchWorkoutManager.shared)
        .environmentObject(WatchConnectivityManager.shared)
}
