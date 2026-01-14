import Foundation
import HealthKit
import Combine
import WatchConnectivity

// MARK: - Watch Timer Model
struct WatchTimer: Identifiable {
    let id: String
    var type: TimerType
    var state: TimerState
    var duration: Int
    var remaining: Int
    var elapsed: Int
    var exerciseId: String?
    var setId: String?
    
    var progress: CGFloat {
        guard duration > 0 else { return 0 }
        return CGFloat(duration - remaining) / CGFloat(duration)
    }
    
    var displayTime: String {
        let minutes = remaining / 60
        let seconds = remaining % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
    
    var isActive: Bool {
        state == .running
    }
}

/// Manages workout sessions on Apple Watch with HealthKit integration
/// Handles heart rate collection, calorie tracking, and workout persistence
class WatchWorkoutManager: NSObject, ObservableObject {
    static let shared = WatchWorkoutManager()
    
    // MARK: - Published Properties
    @Published var isWorkoutActive = false
    @Published var currentHeartRate: Double?
    @Published var heartRateTimestamp: Date?
    @Published var activeCalories: Double = 0
    @Published var elapsedSeconds: Int = 0
    @Published var currentExercise: String?
    @Published var currentSetIndex: Int = 0
    @Published var totalSets: Int = 0
    @Published var currentPhase: WorkoutPhase = .warmup
    @Published var activeTimer: WatchTimer?
    @Published var overallProgress: Double = 0
    
    // MARK: - Private Properties
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?
    private var heartRateQuery: HKAnchoredObjectQuery?
    private var timer: Timer?
    private var timerUpdateTimer: Timer?
    private var workoutStartDate: Date?
    
    // Timer state for offline operation
    private var pendingTimerUpdates: [WatchTimer] = []
    private var lastTimerSyncTimestamp: Date?

    
    // Heart rate samples collected during workout
    private(set) var heartRateSamples: [HeartRateSampleData] = []
    
    // Offline data queue for sync when connectivity restored
    private var pendingSetCompletions: [SetCompletionData] = []
    private var pendingSamples: [HeartRateSampleData] = []
    private var lastSyncTimestamp: Date?
    
    // MARK: - Data Types
    struct HeartRateSampleData: Codable {
        let value: Double
        let timestamp: Date
        let source: String
    }
    
    struct SetCompletionData: Codable {
        let exerciseId: String
        let setId: String
        let completedAt: Date
        let heartRateAtCompletion: Double?
    }
    
    // MARK: - Initialization
    private override init() {
        super.init()
    }
    
    // MARK: - HealthKit Authorization
    func requestAuthorization() async -> Bool {
        guard HKHealthStore.isHealthDataAvailable() else {
            return false
        }
        
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]
        
        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.workoutType()
        ]
        
        do {
            try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
            return true
        } catch {
            print("HealthKit authorization failed: \(error)")
            return false
        }
    }

    
    // MARK: - Workout Session Management
    func startWorkout(exerciseName: String? = nil, setIndex: Int = 0, totalSets: Int = 0) async {
        guard !isWorkoutActive else { return }
        
        _ = await requestAuthorization()
        
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        
        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            workoutBuilder = workoutSession?.associatedWorkoutBuilder()
            
            workoutSession?.delegate = self
            workoutBuilder?.delegate = self
            workoutBuilder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            
            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            try await workoutBuilder?.beginCollection(at: startDate)
            
            await MainActor.run {
                self.workoutStartDate = startDate
                self.isWorkoutActive = true
                self.currentExercise = exerciseName
                self.currentSetIndex = setIndex
                self.totalSets = totalSets
                self.elapsedSeconds = 0
                self.activeCalories = 0
                self.heartRateSamples = []
            }
            
            startHeartRateQuery()
            startTimer()
            
        } catch {
            print("Failed to start workout: \(error)")
        }
    }
    
    func endWorkout() async {
        guard isWorkoutActive else { return }
        
        stopHeartRateQuery()
        stopTimer()
        stopTimerUpdateLoop()
        workoutSession?.end()
        
        do {
            try await workoutBuilder?.endCollection(at: Date())
            try await workoutBuilder?.finishWorkout()
        } catch {
            print("Failed to end workout: \(error)")
        }
        
        syncPendingData()
        
        await MainActor.run {
            self.isWorkoutActive = false
            self.workoutSession = nil
            self.workoutBuilder = nil
            self.currentExercise = nil
            self.activeTimer = nil
        }
    }
    
    func pauseWorkout() {
        workoutSession?.pause()
        stopTimer()
    }
    
    func resumeWorkout() {
        workoutSession?.resume()
        startTimer()
    }

    
    // MARK: - Exercise Tracking
    func updateExercise(name: String, setIndex: Int, totalSets: Int) {
        DispatchQueue.main.async {
            self.currentExercise = name
            self.currentSetIndex = setIndex
            self.totalSets = totalSets
        }
    }
    
    func completeSet(exerciseId: String, setId: String) {
        let completion = SetCompletionData(
            exerciseId: exerciseId,
            setId: setId,
            completedAt: Date(),
            heartRateAtCompletion: currentHeartRate
        )
        pendingSetCompletions.append(completion)
        sendSetCompletion(completion)
    }
    
    // MARK: - Heart Rate Monitoring
    private func startHeartRateQuery() {
        guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return
        }
        
        let predicate = HKQuery.predicateForSamples(
            withStart: workoutStartDate ?? Date(),
            end: nil,
            options: .strictStartDate
        )
        
        heartRateQuery = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: predicate,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }
        
        heartRateQuery?.updateHandler = { [weak self] _, samples, _, _, _ in
            self?.processHeartRateSamples(samples)
        }
        
        if let query = heartRateQuery {
            healthStore.execute(query)
        }
    }
    
    private func processHeartRateSamples(_ samples: [HKSample]?) {
        guard let samples = samples as? [HKQuantitySample], !samples.isEmpty else {
            return
        }
        
        let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
        
        for sample in samples {
            let value = sample.quantity.doubleValue(for: heartRateUnit)
            let sampleData = HeartRateSampleData(
                value: value,
                timestamp: sample.startDate,
                source: "watch"
            )
            heartRateSamples.append(sampleData)
            pendingSamples.append(sampleData)
        }
        
        if let latestSample = samples.last {
            let value = latestSample.quantity.doubleValue(for: heartRateUnit)
            DispatchQueue.main.async {
                self.currentHeartRate = value
                self.heartRateTimestamp = latestSample.startDate
            }
            sendHeartRateUpdate(value: value, timestamp: latestSample.startDate)
        }
    }
    
    private func stopHeartRateQuery() {
        if let query = heartRateQuery {
            healthStore.stop(query)
            heartRateQuery = nil
        }
    }

    
    // MARK: - Timer Management
    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                self?.elapsedSeconds += 1
            }
        }
    }
    
    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
    
    // MARK: - Active Timer Management
    
    /// Start a new timer from iPhone sync
    func startActiveTimer(id: String, duration: Int, type: TimerType, exerciseId: String? = nil, setId: String? = nil) {
        DispatchQueue.main.async {
            self.activeTimer = WatchTimer(
                id: id,
                type: type,
                state: .running,
                duration: duration,
                remaining: duration,
                elapsed: 0,
                exerciseId: exerciseId,
                setId: setId
            )
            self.startTimerUpdateLoop()
        }
    }
    
    /// Update timer state from iPhone sync
    func updateTimerState(id: String, state: TimerState, remaining: Int, elapsed: Int) {
        DispatchQueue.main.async {
            guard var timer = self.activeTimer, timer.id == id else { return }
            timer.state = state
            timer.remaining = remaining
            timer.elapsed = elapsed
            self.activeTimer = timer
            
            if state == .running {
                self.startTimerUpdateLoop()
            } else {
                self.stopTimerUpdateLoop()
            }
        }
    }
    
    /// Pause the active timer (local action)
    func pauseActiveTimer() {
        guard var timer = activeTimer, timer.state == .running else { return }
        timer.state = .paused
        activeTimer = timer
        stopTimerUpdateLoop()
        
        // Send pause message to iPhone
        let message: [String: Any] = [
            "type": "TIMER_PAUSE",
            "payload": ["timerId": timer.id]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    /// Resume the active timer (local action)
    func resumeActiveTimer() {
        guard var timer = activeTimer, timer.state == .paused else { return }
        timer.state = .running
        activeTimer = timer
        startTimerUpdateLoop()
        
        // Send resume message to iPhone
        let message: [String: Any] = [
            "type": "TIMER_RESUME",
            "payload": ["timerId": timer.id]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    /// Skip the active timer (local action)
    func skipActiveTimer() {
        guard let timer = activeTimer else { return }
        stopTimerUpdateLoop()
        activeTimer = nil
        
        // Send skip message to iPhone
        let message: [String: Any] = [
            "type": "TIMER_SKIP",
            "payload": ["timerId": timer.id]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    /// Adjust the active timer duration (local action, for rest timers)
    func adjustActiveTimer(by seconds: Int) {
        guard var timer = activeTimer, timer.type == .rest else { return }
        
        // Ensure bounds: 15s to 300s
        let newDuration = max(15, min(300, timer.duration + seconds))
        let durationChange = newDuration - timer.duration
        
        timer.duration = newDuration
        timer.remaining = max(0, timer.remaining + durationChange)
        activeTimer = timer
        
        // Send adjustment message to iPhone
        let message: [String: Any] = [
            "type": "TIMER_ADJUST",
            "payload": [
                "timerId": timer.id,
                "adjustment": seconds
            ]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    /// Clear the active timer
    func clearActiveTimer() {
        stopTimerUpdateLoop()
        activeTimer = nil
    }
    
    /// Update workout phase
    func updatePhase(_ phase: WorkoutPhase) {
        DispatchQueue.main.async {
            self.currentPhase = phase
        }
    }
    
    /// Update overall progress
    func updateOverallProgress(_ progress: Double) {
        DispatchQueue.main.async {
            self.overallProgress = progress
        }
    }
    
    // MARK: - Timer Update Loop
    private func startTimerUpdateLoop() {
        stopTimerUpdateLoop()
        timerUpdateTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateActiveTimerTick()
        }
    }
    
    private func stopTimerUpdateLoop() {
        timerUpdateTimer?.invalidate()
        timerUpdateTimer = nil
    }
    
    private func updateActiveTimerTick() {
        guard var timer = activeTimer, timer.state == .running else { return }
        
        if timer.type == .workout {
            // Workout timer counts up
            timer.elapsed += 1
        } else {
            // Exercise and rest timers count down
            if timer.remaining > 0 {
                timer.remaining -= 1
                timer.elapsed += 1
            }
            
            // Check for completion
            if timer.remaining <= 0 {
                timer.state = .completed
                stopTimerUpdateLoop()
                
                // Send completion message to iPhone
                let message: [String: Any] = [
                    "type": "TIMER_COMPLETE",
                    "payload": ["timerId": timer.id]
                ]
                WatchConnectivityManager.shared.sendMessage(message)
            }
        }
        
        DispatchQueue.main.async {
            self.activeTimer = timer
        }
    }
    
    // MARK: - Offline Timer Sync
    func syncTimerState() {
        guard WatchConnectivityManager.shared.isReachable else { return }
        
        // Request full session state from iPhone
        let message: [String: Any] = [
            "type": "SYNC_REQUEST",
            "payload": ["lastSyncTimestamp": (lastTimerSyncTimestamp ?? Date()).timeIntervalSince1970]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
        lastTimerSyncTimestamp = Date()
    }
    
    // MARK: - Watch Connectivity
    private func sendHeartRateUpdate(value: Double, timestamp: Date) {
        let message: [String: Any] = [
            "type": "HEART_RATE_UPDATE",
            "payload": [
                "value": value,
                "timestamp": timestamp.timeIntervalSince1970,
                "source": "watch"
            ]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    private func sendSetCompletion(_ completion: SetCompletionData) {
        let message: [String: Any] = [
            "type": "SET_COMPLETED",
            "payload": [
                "exerciseId": completion.exerciseId,
                "setId": completion.setId,
                "completedAt": completion.completedAt.timeIntervalSince1970,
                "heartRateAtCompletion": completion.heartRateAtCompletion ?? NSNull()
            ]
        ]
        WatchConnectivityManager.shared.sendMessage(message)
    }
    
    // MARK: - Offline Sync
    func syncPendingData() {
        guard WatchConnectivityManager.shared.isReachable else { return }
        
        for completion in pendingSetCompletions {
            sendSetCompletion(completion)
        }
        
        if !pendingSamples.isEmpty {
            let samplesPayload = pendingSamples.map { sample in
                ["value": sample.value, "timestamp": sample.timestamp.timeIntervalSince1970, "source": sample.source] as [String: Any]
            }
            let message: [String: Any] = [
                "type": "SYNC_HEART_RATE_SAMPLES",
                "payload": ["samples": samplesPayload, "lastSyncTimestamp": (lastSyncTimestamp ?? Date()).timeIntervalSince1970]
            ]
            WatchConnectivityManager.shared.sendMessage(message)
        }
        
        pendingSetCompletions.removeAll()
        pendingSamples.removeAll()
        lastSyncTimestamp = Date()
    }
    
    var averageHeartRate: Double? {
        guard !heartRateSamples.isEmpty else { return nil }
        return heartRateSamples.reduce(0) { $0 + $1.value } / Double(heartRateSamples.count)
    }
    
    var maxHeartRate: Double? {
        heartRateSamples.map { $0.value }.max()
    }
}


// MARK: - HKWorkoutSessionDelegate
extension WatchWorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        DispatchQueue.main.async {
            switch toState {
            case .running: self.isWorkoutActive = true
            case .ended: self.isWorkoutActive = false
            default: break
            }
        }
    }
    
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Workout session failed: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WatchWorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  quantityType == HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else { continue }
            
            let value = workoutBuilder.statistics(for: quantityType)?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
            DispatchQueue.main.async { self.activeCalories = value }
        }
    }
    
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
