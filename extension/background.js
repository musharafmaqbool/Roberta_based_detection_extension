/**
 * Background Service Worker (Local Mode)
 * Robust messaging implementation.
 */

let tabStats = {};

const DARK_PATTERN_KEYWORDS = [
    "hurry", "only a few left", "offer ends in", "act fast",
    "no thanks", "prefer paying full price", "skip this exclusive offer",
    "people are viewing this", "just bought this", "must agree", "required to continue"
];

const PHISHING_KEYWORDS = [
    "verify your account", "update your billing", "account suspended", 
    "login immediately", "claim your prize", "click here to secure",
    "password expired", "unusual sign-in activity"
];

function localAnalyze(text) {
    const lowerText = text.toLowerCase();
    
    for (let word of PHISHING_KEYWORDS) {
        if (lowerText.includes(word)) {
            return {
                is_phishing: true, phishing_conf: 0.95,
                is_dark_pattern: false, dark_pattern_conf: 0,
                category: "Social Engineering",
                explanation: `Local Rule Match: Contains suspicious phrase '${word}'`
            };
        }
    }

    for (let word of DARK_PATTERN_KEYWORDS) {
        if (lowerText.includes(word)) {
            return {
                is_phishing: false, phishing_conf: 0,
                is_dark_pattern: true, dark_pattern_conf: 0.85,
                category: "Manipulative Language",
                explanation: `Local Rule Match: Contains manipulative phrase '${word}'`
            };
        }
    }

    return null; 
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === "analyze") {
            const tabId = sender.tab ? sender.tab.id : null;
            if (!tabId) {
                console.error("❌ Background: No tabId found for sender.");
                sendResponse({ error: "No tab ID found" });
                return true;
            }

            console.group(`⚙️ Sentinel Background: Processing Payload from Tab ${tabId}`);
            console.log("Received elements:", request.payload?.elements?.length);

            chrome.storage.local.get([tabId.toString()], (data) => {
                let stats = data[tabId.toString()] || { dpCount: 0, phishCount: 0, overallRisk: 0 };
                const results = [];
                let batchRiskScore = 0;

                if (request.payload && Array.isArray(request.payload.elements)) {
                    request.payload.elements.forEach(element => {
                        const prediction = localAnalyze(element.text);
                        if (prediction) {
                            const risk = prediction.is_phishing ? prediction.phishing_conf * 1.5 : prediction.dark_pattern_conf;
                            batchRiskScore += risk;

                            if (prediction.is_dark_pattern) stats.dpCount++;
                            if (prediction.is_phishing) stats.phishCount++;

                            results.push({ id: element.id, ...prediction });
                        }
                    });
                }

                stats.overallRisk = Math.max(stats.overallRisk, Math.min(10, batchRiskScore));

                console.log("Detection Results:", results);
                console.log("Updated Tab Stats:", stats);
                console.groupEnd();

                // Save persistent state
                chrome.storage.local.set({ [tabId.toString()]: stats }, () => {
                    sendResponse({ 
                        results: results,
                        overall_risk_score: stats.overallRisk
                    });
                });
            });

            return true; // Keep message channel open for async storage response
        }

        if (request.action === "get_stats") {
            if (!request.tabId) {
                sendResponse({ dpCount: 0, phishCount: 0, overallRisk: 0 });
                return true;
            }
            
            chrome.storage.local.get([request.tabId.toString()], (data) => {
                const stats = data[request.tabId.toString()] || { dpCount: 0, phishCount: 0, overallRisk: 0 };
                sendResponse(stats);
            });
            return true;
        }

        sendResponse({ error: "Unknown action" });
        return true;

    } catch (err) {
        console.error("🚨 Sentinel Background Error:", err);
        sendResponse({ error: "Internal extension error" });
        return true;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(tabId.toString());
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        chrome.storage.local.set({ [tabId.toString()]: { dpCount: 0, phishCount: 0, overallRisk: 0 } });
    }
});
