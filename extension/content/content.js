console.log("🚀 [Sentinel Content] Bootstrapping content script...");

function initializeSentinel() {
    try {
        console.log("🚀 [Sentinel Content] Verifying modules...");
        
        // Verify all required modules are loaded sequentially by manifest.json
        const requiredModules = [
            'SentinelHashing',
            'SentinelHelpers',
            'SentinelMessaging',
            'SentinelHighlights',
            'SentinelUIManager',
            'SentinelBatching',
            'SentinelDOMScanner'
        ];

        for (const mod of requiredModules) {
            if (!window[mod]) {
                throw new Error(`Module ${mod} failed to load. Check manifest.json injection order.`);
            }
        }

        console.log("🚀 [Sentinel Content] All modules present. Initializing instances...");

        // 1. Initialize UI Manager
        const uiManager = new window.SentinelUIManager();
        uiManager.init();

        // 2. Initialize Messaging and Batching
        const messaging = window.SentinelMessaging;
        const batching = new window.SentinelBatching(messaging);

        // 3. Initialize Core Scanner
        const domScanner = new window.SentinelDOMScanner(
            batching,
            window.SentinelHelpers,
            window.SentinelHashing
        );

        // 4. Start Scanner with callback for handling results
        domScanner.start((results) => {
            console.group("🚨 [Sentinel Content] Processing Detection Results");
            if (results.length === 0) {
                console.log("✅ No dark patterns or phishing detected in this batch.");
            } else {
                console.warn(`⚠️ Detected ${results.length} suspicious elements!`);
                results.forEach(result => {
                    const element = domScanner.getNode(result.id);
                    if (element) {
                        uiManager.processElement(element, result);
                    } else {
                        console.error("❌ [Sentinel Content] Element not found in nodeMap for ID:", result.id);
                    }
                    // Memory cleanup
                    domScanner.removeNode(result.id);
                });
            }
            console.groupEnd();
        });

        console.log("✅ [Sentinel Content] Bootstrap complete. Extension is active.");

    } catch (err) {
        console.error("💥 [Sentinel Content] Fatal initialization error:", err);
    }
}

// Ensure the document is ready before bootstrapping
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSentinel);
} else {
    initializeSentinel();
}
