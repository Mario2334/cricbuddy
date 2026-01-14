import Foundation
import Combine
import WatchConnectivity

/// Manages Watch Connectivity communication with the iOS app
class WatchConnectivityManager: NSObject, ObservableObject {
    static let shared = WatchConnectivityManager()
    
    @Published var isReachable = false
    @Published var isPaired = false
    @Published var isWatchAppInstalled = false
    
    private var session: WCSession?
    private var messageQueue: [[String: Any]] = []
    private let messageQueueLock = NSLock()
    
    var onMessageReceived: (([String: Any]) -> Void)?
    var onApplicationContextReceived: (([String: Any]) -> Void)?
    
    private override init() { super.init() }
    
    func activate() {
        guard WCSession.isSupported() else { return }
        session = WCSession.default
        session?.delegate = self
        session?.activate()
    }
    
    func sendMessage(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)? = nil) {
        guard let session = session else { queueMessage(message); return }
        
        if session.isReachable {
            session.sendMessage(message, replyHandler: { response in replyHandler?(response) }) { [weak self] _ in
                self?.queueMessage(message)
            }
        } else {
            queueMessage(message)
        }
    }
    
    private func queueMessage(_ message: [String: Any]) {
        messageQueueLock.lock()
        defer { messageQueueLock.unlock() }
        messageQueue.append(message)
    }
    
    private func flushMessageQueue() {
        messageQueueLock.lock()
        let messages = messageQueue
        messageQueue.removeAll()
        messageQueueLock.unlock()
        messages.forEach { sendMessage($0) }
    }
    
    func updateApplicationContext(_ context: [String: Any]) {
        try? session?.updateApplicationContext(context)
    }
}


// MARK: - WCSessionDelegate
extension WatchConnectivityManager: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { self.isReachable = session.isReachable }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.flushMessageQueue()
                WatchWorkoutManager.shared.syncPendingData()
                OfflineSyncManager.shared.syncPendingData()
            }
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleReceivedMessage(message)
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleReceivedMessage(message)
        replyHandler(["status": "received"])
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async {
            self.onApplicationContextReceived?(applicationContext)
            self.handleApplicationContext(applicationContext)
        }
    }
    
    private func handleReceivedMessage(_ message: [String: Any]) {
        DispatchQueue.main.async { self.onMessageReceived?(message) }
        guard let type = message["type"] as? String else { return }
        
        switch type {
        case "START_WORKOUT": handleStartWorkout(message)
        case "END_WORKOUT": Task { await WatchWorkoutManager.shared.endWorkout() }
        case "UPDATE_EXERCISE": handleUpdateExercise(message)
        case "SYNC_REQUEST": WatchWorkoutManager.shared.syncPendingData()
        // Timer messages
        case "TIMER_START": handleTimerStart(message)
        case "TIMER_PAUSE": handleTimerPause(message)
        case "TIMER_RESUME": handleTimerResume(message)
        case "TIMER_COMPLETE": handleTimerComplete(message)
        case "TIMER_SKIP": handleTimerSkip(message)
        case "TIMER_STATE_UPDATE": handleTimerStateUpdate(message)
        case "PHASE_CHANGE": handlePhaseChange(message)
        case "SESSION_STATE": handleSessionState(message)
        default: break
        }
    }
    
    // MARK: - Timer Message Handlers
    private func handleTimerStart(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String,
              let duration = payload["duration"] as? Int,
              let timerTypeStr = payload["timerType"] as? String,
              let timerType = TimerType(rawValue: timerTypeStr) else { return }
        
        let exerciseId = payload["exerciseId"] as? String
        let setId = payload["setId"] as? String
        
        WatchWorkoutManager.shared.startActiveTimer(
            id: timerId,
            duration: duration,
            type: timerType,
            exerciseId: exerciseId,
            setId: setId
        )
    }
    
    private func handleTimerPause(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String else { return }
        
        if WatchWorkoutManager.shared.activeTimer?.id == timerId {
            WatchWorkoutManager.shared.updateTimerState(
                id: timerId,
                state: .paused,
                remaining: WatchWorkoutManager.shared.activeTimer?.remaining ?? 0,
                elapsed: WatchWorkoutManager.shared.activeTimer?.elapsed ?? 0
            )
        }
    }
    
    private func handleTimerResume(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String else { return }
        
        if WatchWorkoutManager.shared.activeTimer?.id == timerId {
            WatchWorkoutManager.shared.updateTimerState(
                id: timerId,
                state: .running,
                remaining: WatchWorkoutManager.shared.activeTimer?.remaining ?? 0,
                elapsed: WatchWorkoutManager.shared.activeTimer?.elapsed ?? 0
            )
        }
    }
    
    private func handleTimerComplete(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String else { return }
        
        if WatchWorkoutManager.shared.activeTimer?.id == timerId {
            WatchWorkoutManager.shared.clearActiveTimer()
        }
    }
    
    private func handleTimerSkip(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String else { return }
        
        if WatchWorkoutManager.shared.activeTimer?.id == timerId {
            WatchWorkoutManager.shared.clearActiveTimer()
        }
    }
    
    private func handleTimerStateUpdate(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let timerId = payload["timerId"] as? String,
              let stateStr = payload["state"] as? String,
              let state = TimerState(rawValue: stateStr),
              let remaining = payload["remaining"] as? Int,
              let elapsed = payload["elapsed"] as? Int else { return }
        
        WatchWorkoutManager.shared.updateTimerState(
            id: timerId,
            state: state,
            remaining: remaining,
            elapsed: elapsed
        )
    }
    
    private func handlePhaseChange(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let phaseStr = payload["phase"] as? String,
              let phase = WorkoutPhase(rawValue: phaseStr) else { return }
        
        WatchWorkoutManager.shared.updatePhase(phase)
    }
    
    private func handleSessionState(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any] else { return }
        
        // Update phase
        if let phaseStr = payload["currentPhase"] as? String,
           let phase = WorkoutPhase(rawValue: phaseStr) {
            WatchWorkoutManager.shared.updatePhase(phase)
        }
        
        // Update exercise info
        if let exerciseName = payload["currentExercise"] as? String {
            let currentSet = payload["currentSet"] as? Int ?? 0
            let totalSets = payload["totalSets"] as? Int ?? 0
            WatchWorkoutManager.shared.updateExercise(name: exerciseName, setIndex: currentSet, totalSets: totalSets)
        }
        
        // Update overall progress
        if let progress = payload["overallProgress"] as? Double {
            WatchWorkoutManager.shared.updateOverallProgress(progress)
        }
        
        // Update active timers
        if let activeTimers = payload["activeTimers"] as? [[String: Any]], !activeTimers.isEmpty {
            // Use the first active timer
            if let timerData = activeTimers.first,
               let timerId = timerData["timerId"] as? String,
               let timerTypeStr = timerData["timerType"] as? String,
               let timerType = TimerType(rawValue: timerTypeStr),
               let stateStr = timerData["state"] as? String,
               let state = TimerState(rawValue: stateStr),
               let duration = timerData["duration"] as? Int,
               let remaining = timerData["remaining"] as? Int,
               let elapsed = timerData["elapsed"] as? Int {
                
                if WatchWorkoutManager.shared.activeTimer?.id != timerId {
                    WatchWorkoutManager.shared.startActiveTimer(
                        id: timerId,
                        duration: duration,
                        type: timerType
                    )
                }
                WatchWorkoutManager.shared.updateTimerState(
                    id: timerId,
                    state: state,
                    remaining: remaining,
                    elapsed: elapsed
                )
            }
        } else {
            WatchWorkoutManager.shared.clearActiveTimer()
        }
    }
    
    private func handleApplicationContext(_ context: [String: Any]) {
        guard let isWorkoutActive = context["isWorkoutActive"] as? Bool else { return }
        
        if isWorkoutActive && !WatchWorkoutManager.shared.isWorkoutActive {
            Task {
                await WatchWorkoutManager.shared.startWorkout(
                    exerciseName: context["currentExercise"] as? String,
                    setIndex: context["currentSet"] as? Int ?? 0,
                    totalSets: context["totalSets"] as? Int ?? 0
                )
            }
        } else if !isWorkoutActive && WatchWorkoutManager.shared.isWorkoutActive {
            Task { await WatchWorkoutManager.shared.endWorkout() }
        }
    }
    
    private func handleStartWorkout(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any] else { return }
        Task {
            await WatchWorkoutManager.shared.startWorkout(
                exerciseName: payload["exerciseName"] as? String,
                setIndex: payload["setIndex"] as? Int ?? 0,
                totalSets: payload["totalSets"] as? Int ?? 0
            )
        }
    }
    
    private func handleUpdateExercise(_ message: [String: Any]) {
        guard let payload = message["payload"] as? [String: Any],
              let name = payload["exerciseName"] as? String else { return }
        WatchWorkoutManager.shared.updateExercise(
            name: name,
            setIndex: payload["setIndex"] as? Int ?? 0,
            totalSets: payload["totalSets"] as? Int ?? 0
        )
    }
}
