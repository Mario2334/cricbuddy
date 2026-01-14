import Foundation
import Combine

/// Manages offline data storage and synchronization for the Watch app
class OfflineSyncManager: ObservableObject {
    static let shared = OfflineSyncManager()
    
    @Published var pendingItemCount: Int = 0
    @Published var lastSyncTimestamp: Date?
    @Published var isSyncing: Bool = false
    
    private let userDefaults = UserDefaults.standard
    private let pendingDataKey = "pendingOfflineData"
    private let lastSyncKey = "lastSyncTimestamp"
    private let syncQueue = DispatchQueue(label: "com.cricbuddy.offlineSync")
    
    struct PendingData: Codable {
        let id: String
        let type: DataType
        let payload: Data
        let timestamp: Date
        let retryCount: Int
        
        enum DataType: String, Codable {
            case heartRateSample, setCompletion, workoutSummary, exerciseMetrics
        }
    }
    
    private init() {
        pendingItemCount = loadPendingData().count
        lastSyncTimestamp = userDefaults.object(forKey: lastSyncKey) as? Date
    }
    
    func queueData<T: Encodable>(_ data: T, type: PendingData.DataType) {
        syncQueue.async { [weak self] in
            guard let self = self, let payload = try? JSONEncoder().encode(data) else { return }
            var items = self.loadPendingData()
            items.append(PendingData(id: UUID().uuidString, type: type, payload: payload, timestamp: Date(), retryCount: 0))
            self.savePendingData(items)
            DispatchQueue.main.async { self.pendingItemCount = items.count }
        }
    }
    
    func queueHeartRateSample(_ sample: WatchWorkoutManager.HeartRateSampleData) {
        queueData(sample, type: .heartRateSample)
    }
    
    func queueSetCompletion(_ completion: WatchWorkoutManager.SetCompletionData) {
        queueData(completion, type: .setCompletion)
    }

    
    func syncPendingData() {
        guard !isSyncing, WatchConnectivityManager.shared.isReachable else { return }
        
        syncQueue.async { [weak self] in
            guard let self = self else { return }
            DispatchQueue.main.async { self.isSyncing = true }
            
            var failedItems: [PendingData] = []
            for item in self.loadPendingData() {
                if !self.syncItem(item), item.retryCount < 5 {
                    failedItems.append(PendingData(id: item.id, type: item.type, payload: item.payload, timestamp: item.timestamp, retryCount: item.retryCount + 1))
                }
            }
            
            self.savePendingData(failedItems)
            DispatchQueue.main.async {
                self.pendingItemCount = failedItems.count
                self.lastSyncTimestamp = Date()
                self.isSyncing = false
                self.userDefaults.set(self.lastSyncTimestamp, forKey: self.lastSyncKey)
            }
        }
    }
    
    private func syncItem(_ item: PendingData) -> Bool {
        var message: [String: Any] = [:]
        
        switch item.type {
        case .heartRateSample:
            guard let sample = try? JSONDecoder().decode(WatchWorkoutManager.HeartRateSampleData.self, from: item.payload) else { return false }
            message = ["type": "HEART_RATE_UPDATE", "payload": ["value": sample.value, "timestamp": sample.timestamp.timeIntervalSince1970, "source": sample.source]]
        case .setCompletion:
            guard let completion = try? JSONDecoder().decode(WatchWorkoutManager.SetCompletionData.self, from: item.payload) else { return false }
            message = ["type": "SET_COMPLETED", "payload": ["exerciseId": completion.exerciseId, "setId": completion.setId, "completedAt": completion.completedAt.timeIntervalSince1970, "heartRateAtCompletion": completion.heartRateAtCompletion ?? NSNull()]]
        default:
            message = ["type": "SYNC_DATA", "payload": ["dataType": item.type.rawValue, "data": item.payload.base64EncodedString()]]
        }
        
        var success = false
        let semaphore = DispatchSemaphore(value: 0)
        WatchConnectivityManager.shared.sendMessage(message) { _ in success = true; semaphore.signal() }
        return semaphore.wait(timeout: .now() + 5.0) == .success && success
    }
    
    private func loadPendingData() -> [PendingData] {
        guard let data = userDefaults.data(forKey: pendingDataKey) else { return [] }
        return (try? JSONDecoder().decode([PendingData].self, from: data)) ?? []
    }
    
    private func savePendingData(_ items: [PendingData]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        userDefaults.set(data, forKey: pendingDataKey)
    }
    
    func clearPendingData() {
        syncQueue.async { [weak self] in
            self?.savePendingData([])
            DispatchQueue.main.async { self?.pendingItemCount = 0 }
        }
    }
}
