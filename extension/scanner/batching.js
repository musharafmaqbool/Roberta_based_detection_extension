console.log("📦 [Sentinel Scanner] Initializing batching module...");

class SentinelBatching {
    constructor(messagingService) {
        this.messaging = messagingService;
        this.elementBatch = [];
        this.batchTimeout = null;
        this.DEBOUNCE_DELAY_MS = 1000;
        this.MAX_QUEUE_SIZE = 100;
        this.isFlushing = false;
        console.log("📦 [Sentinel Scanner] Batching module created with safety constraints.");
    }

    /**
     * Adds an element's data to the current batch.
     * @param {Object} elementData 
     */
    add(elementData) {
        if (!elementData || !elementData.id) return;

        // 1. Ignore duplicate IDs in the current queue
        const isDuplicate = this.elementBatch.some(item => item.id === elementData.id);
        if (isDuplicate) {
            console.log(`🔍 [Sentinel Batching] [DUPLICATE NODE BLOCKED] Element with ID ${elementData.id} is already in the batch queue.`);
            return;
        }

        // 2. Enforce max queue size to prevent loops
        if (this.elementBatch.length >= this.MAX_QUEUE_SIZE) {
            console.warn(`🚨 [Sentinel Batching] [BATCH LOOP PREVENTED] Batch queue size reached limit (${this.MAX_QUEUE_SIZE}). Pruning oldest elements.`);
            this.elementBatch.shift();
        }

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

        // 3. Prevent duplicate concurrent flushing
        if (this.isFlushing) {
            console.warn("⚠️ [Sentinel Batching] [BATCH LOOP PREVENTED] Flush already in progress. Skipping.");
            return;
        }

        this.isFlushing = true;

        // 4. Timeout fail-safe to clear stuck state
        const failSafeTimeout = setTimeout(() => {
            if (this.isFlushing) {
                console.error("❌ [Sentinel Batching] Flush operation timed out. Resetting state.");
                this.isFlushing = false;
            }
        }, 10000);

        const batchToSend = [...this.elementBatch];
        this.elementBatch = [];

        console.log(`🚀 [Sentinel Batching] Flushing batch of ${batchToSend.length} elements.`);

        try {
            // Promise timeout for messaging
            const responsePromise = this.messaging.sendMessage({
                action: "analyze",
                payload: { elements: batchToSend }
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Extension response timeout")), 8000)
            );

            const response = await Promise.race([responsePromise, timeoutPromise]);
            
            if (response && response.results) {
                console.log(`📥 [Sentinel Batching] Received ${response.results.length} results from background.`);
                onResultsCallback(response.results);
            } else {
                console.warn("⚠️ [Sentinel Batching] Background responded without results.");
            }
        } catch (err) {
            console.error("❌ [Sentinel Batching] Failed to flush batch:", err);
            this.elementBatch = []; // Clear stuck batch on error
        } finally {
            clearTimeout(failSafeTimeout);
            this.isFlushing = false;
        }
    }
}

window.SentinelBatching = SentinelBatching;
console.log("✅ [Sentinel Scanner] Batching module initialized.");
