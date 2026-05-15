console.log("📦 [Sentinel Scanner] Initializing batching module...");

class SentinelBatching {
    constructor(messagingService) {
        this.messaging = messagingService;
        this.elementBatch = [];
        this.batchTimeout = null;
        this.DEBOUNCE_DELAY_MS = 1000;
        console.log("📦 [Sentinel Scanner] Batching module created.");
    }

    /**
     * Adds an element's data to the current batch.
     * @param {Object} elementData 
     */
    add(elementData) {
        this.elementBatch.push(elementData);
    }

    /**
     * Debounces the flush operation.
     * @param {Function} onResultsCallback 
     */
    debounce(onResultsCallback) {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        console.log(`⏱️ [Sentinel Batching] Timer reset. Waiting ${this.DEBOUNCE_DELAY_MS}ms...`);
        
        this.batchTimeout = setTimeout(() => {
            console.log(`⏱️ [Sentinel Batching] Timer expired! Executing flush.`);
            this.flush(onResultsCallback);
        }, this.DEBOUNCE_DELAY_MS);
    }

    /**
     * Flushes the current batch to the background script.
     * @param {Function} onResultsCallback 
     */
    async flush(onResultsCallback) {
        if (this.elementBatch.length === 0) {
            console.log("⚠️ [Sentinel Batching] Batch is empty, nothing to send.");
            return;
        }

        const batchToSend = [...this.elementBatch];
        this.elementBatch = [];

        console.log(`🚀 [Sentinel Batching] Flushing batch of ${batchToSend.length} elements.`);

        try {
            const response = await this.messaging.sendMessage({
                action: "analyze",
                payload: { elements: batchToSend }
            });
            
            if (response && response.results) {
                console.log(`📥 [Sentinel Batching] Received ${response.results.length} results from background.`);
                onResultsCallback(response.results);
            } else {
                console.warn("⚠️ [Sentinel Batching] Background responded without results.");
            }
        } catch (err) {
            console.error("❌ [Sentinel Batching] Failed to flush batch:", err);
        }
    }
}

window.SentinelBatching = SentinelBatching;
console.log("✅ [Sentinel Scanner] Batching module initialized.");
