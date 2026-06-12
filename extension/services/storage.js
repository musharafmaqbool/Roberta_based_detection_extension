// Storage service for the background service worker
console.log("💾 [Sentinel Services] Initializing storage module...");

export class SentinelStorage {
    static async getTabStats(tabId) {
        return new Promise((resolve) => {
            chrome.storage.local.get([tabId.toString()], (data) => {
                const stats = data[tabId.toString()] || { dpCount: 0, phishCount: 0, overallRisk: 0, recentDetections: [] };
                console.log(`💾 [Sentinel Storage] Retrieved stats for tab ${tabId}:`, stats);
                resolve(stats);
            });
        });
    }

    static async saveTabStats(tabId, stats) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [tabId.toString()]: stats }, () => {
                console.log(`💾 [Sentinel Storage] Saved stats for tab ${tabId}:`, stats);
                resolve();
            });
        });
    }

    static async clearTabStats(tabId) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(tabId.toString(), () => {
                console.log(`🗑️ [Sentinel Storage] Cleared stats for tab ${tabId}`);
                resolve();
            });
        });
    }
}

console.log("✅ [Sentinel Services] Storage module initialized.");
