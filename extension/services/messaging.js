console.log("📡 [Sentinel Services] Initializing messaging module...");

class SentinelMessaging {
    /**
     * Sends a message to the background service worker.
     * @param {Object} payload 
     * @returns {Promise<any>}
     */
    static sendMessage(payload) {
        return new Promise((resolve, reject) => {
            console.log(`📡 [Sentinel Messaging] Sending action: ${payload.action}`, payload);
            chrome.runtime.sendMessage(payload, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ [Sentinel Messaging] Background unreachable:", chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError);
                } else if (response && response.error) {
                    console.error("❌ [Sentinel Messaging] Error from background:", response.error);
                    reject(new Error(response.error));
                } else {
                    console.log(`✅ [Sentinel Messaging] Response received for: ${payload.action}`, response);
                    resolve(response);
                }
            });
        });
    }
}

window.SentinelMessaging = SentinelMessaging;
console.log("✅ [Sentinel Services] Messaging module initialized.");
