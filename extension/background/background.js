import { SentinelStorage } from '../services/storage.js';

console.log("⚙️ [Sentinel Background] Initializing service worker...");

const BACKEND_URL = "http://localhost:8000/analyze";

/**
 * Sends a batch of elements to the FastAPI backend
 */
async function analyzeWithBackend(payload) {
    const startTime = performance.now();

    try {
        console.log(`🌐 [Sentinel API] Sending ${payload.elements.length} elements to backend...`);

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
        console.log(`⏱️ Backend responded in ${latency.toFixed(2)}ms`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("📥 Backend Response:", data);

        return data;

    } catch (error) {

        console.error("❌ Backend Error:", error);

        return {
            results: [],
            overall_risk_score: 0,
            error: error.message
        };
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    try {

        // ANALYZE REQUEST
        if (request.action === "analyze") {

            const tabId = sender.tab?.id;

            if (!tabId) {
                sendResponse({ error: "No tab ID found" });
                return true;
            }

            analyzeWithBackend(request.payload)
                .then(async (apiResponse) => {

                    const stats = await SentinelStorage.getTabStats(tabId);

                    const results = apiResponse.results || [];

                    stats.recentDetections =
                        stats.recentDetections || [];

                    results.forEach((prediction) => {

                        if (
                            prediction.is_dark_pattern ||
                            prediction.is_phishing
                        ) {

                            if (prediction.is_dark_pattern) {
                                stats.dpCount++;
                            }

                            if (prediction.is_phishing) {
                                stats.phishCount++;
                            }

                            // ADD DETECTION
                            stats.recentDetections.unshift({

                                id: prediction.id,

                                category:
                                    prediction.is_phishing
                                        ? 'Phishing'
                                        : 'Dark Pattern',

                                explanation:
                                    prediction.explanation ||
                                    'Suspicious activity detected',

                                confidence:
                                    prediction.is_phishing
                                        ? prediction.phishing_conf
                                        : prediction.dark_pattern_conf,

                                text:
                                    prediction.text ||
                                    prediction.explanation ||
                                    'Suspicious element detected'
                            });
                        }
                    });

                    // LIMIT TO 3
                    stats.recentDetections =
                        stats.recentDetections.slice(0, 3);

                    // UPDATE RISK
                    stats.overallRisk = Math.max(
                        stats.overallRisk || 0,
                        apiResponse.overall_risk_score || 0
                    );

                    console.log(
                        "📌 Recent Detections:",
                        stats.recentDetections
                    );

                    await SentinelStorage.saveTabStats(
                        tabId,
                        stats
                    );

                    sendResponse({
                        results,
                        overall_risk_score: stats.overallRisk,
                        error: apiResponse.error
                    });
                });

            return true;
        }

        // GET STATS
        if (request.action === "get_stats") {

            if (!request.tabId) {
                sendResponse({
                    dpCount: 0,
                    phishCount: 0,
                    overallRisk: 0,
                    recentDetections: []
                });

                return true;
            }

            SentinelStorage.getTabStats(request.tabId)
                .then((stats) => {
                    sendResponse(stats);
                });

            return true;
        }

        sendResponse({
            error: "Unknown action"
        });

        return true;

    } catch (err) {

        console.error(
            "🚨 Background Internal Error:",
            err
        );

        sendResponse({
            error: "Internal extension error"
        });

        return true;
    }
});

// CLEANUP
chrome.tabs.onRemoved.addListener((tabId) => {

    SentinelStorage.clearTabStats(tabId);
});

// RESET ON RELOAD
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {

    if (changeInfo.status === 'loading') {

        SentinelStorage.saveTabStats(tabId, {
            dpCount: 0,
            phishCount: 0,
            overallRisk: 0,
            recentDetections: []
        });
    }
});

console.log("✅ Background service worker initialized.");