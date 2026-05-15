import { SentinelStorage } from '../services/storage.js';

console.log("⚙️ [Sentinel Background] Initializing service worker...");

const BACKEND_URL = "http://localhost:8000/analyze";

/**
 * Sends a batch of elements to the FastAPI backend for deception analysis.
 * @param {Object} payload The batch payload matching the backend schema
 * @returns {Promise<Object>} The API response or a safe fallback
 */
async function analyzeWithBackend(payload) {
    const startTime = performance.now();
    try {
        console.log(`🌐 [Sentinel API] Sending ${payload.elements.length} elements to backend...`);
        
        // Timeout handling via AbortController (10 seconds max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const latency = performance.now() - startTime;
        console.log(`⏱️ [Sentinel API] Backend responded in ${latency.toFixed(2)}ms`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("📥 [Sentinel API] Received payload from backend:", data);
        return data;
        
    } catch (error) {
        const latency = performance.now() - startTime;
        console.error(`❌ [Sentinel API] Failed after ${latency.toFixed(2)}ms:`, error.message);
        
        // Graceful fallback: return empty results so the UI doesn't break
        return { 
            results: [], 
            overall_risk_score: 0, 
            error: error.message || "Backend unreachable or timed out." 
        };
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === "analyze") {
            const tabId = sender.tab ? sender.tab.id : null;
            if (!tabId) {
                console.error("❌ [Sentinel Background] No tabId found for sender.");
                sendResponse({ error: "No tab ID found" });
                return true;
            }

            console.group(`⚙️ [Sentinel Background] Processing Payload from Tab ${tabId}`);
            
            // Asynchronously process the batch using the FastAPI backend
            analyzeWithBackend(request.payload).then(apiResponse => {
                SentinelStorage.getTabStats(tabId).then((stats) => {
                    const results = apiResponse.results || [];
                    
                    // Update stats based on backend results
                    results.forEach(prediction => {
                        if (prediction.is_dark_pattern) stats.dpCount++;
                        if (prediction.is_phishing) stats.phishCount++;
                    });
                    
                    // We only increase the risk, never decrease it during a single page lifecycle
                    if (apiResponse.overall_risk_score !== undefined) {
                        stats.overallRisk = Math.max(stats.overallRisk, apiResponse.overall_risk_score);
                    }
                    
                    console.log("Updated Tab Stats:", stats);
                    console.groupEnd();
                    
                    // Save persistent state and respond to content script
                    SentinelStorage.saveTabStats(tabId, stats).then(() => {
                        sendResponse({ 
                            results: results,
                            overall_risk_score: stats.overallRisk,
                            error: apiResponse.error
                        });
                    });
                });
            });

            return true; // Keep message channel open for async response
        }

        if (request.action === "get_stats") {
            if (!request.tabId) {
                sendResponse({ dpCount: 0, phishCount: 0, overallRisk: 0 });
                return true;
            }
            
            SentinelStorage.getTabStats(request.tabId).then((stats) => {
                sendResponse(stats);
            });
            return true;
        }

        sendResponse({ error: "Unknown action" });
        return true;

    } catch (err) {
        console.error("🚨 [Sentinel Background] Internal Error:", err);
        sendResponse({ error: "Internal extension error" });
        return true;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    console.log(`⚙️ [Sentinel Background] Tab ${tabId} removed, clearing stats.`);
    SentinelStorage.clearTabStats(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        console.log(`⚙️ [Sentinel Background] Tab ${tabId} reloaded, resetting stats.`);
        SentinelStorage.saveTabStats(tabId, { dpCount: 0, phishCount: 0, overallRisk: 0 });
    }
});

console.log("✅ [Sentinel Background] Service worker initialized.");
