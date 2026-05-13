/**
 * High-Performance DOM Scanner for Real-Time Deception Detection
 * 
 * Features:
 * - Uses MutationObserver to monitor the DOM in real-time.
 * - Targets specific elements: links, buttons, forms, inputs, modals, banners.
 * - Caches scanned text to prevent duplicate processing.
 * - Debounces DOM updates to minimize CPU usage.
 * - Returns structured JSON batches.
 */

class SentinelDOMScanner {
    constructor() {
        // Configuration
        this.DEBOUNCE_DELAY_MS = 1000; // Wait 1s after DOM settles before sending
        this.MIN_TEXT_LENGTH = 5;
        this.MAX_TEXT_LENGTH = 400;

        // State
        this.scannedHashes = new Set(); // Cache for text hashes
        this.elementBatch = [];         // Elements waiting to be analyzed
        this.batchTimeout = null;       // Timer for debouncing
        this.nodeMap = new Map();       // Maps our internal IDs to actual DOM nodes

        // Target selectors mapping to user requirements:
        // - buttons, links, forms, input fields
        // - modals, banners (often divs/sections with specific roles or classes)
        this.TARGET_SELECTORS = [
            'a', 'button', 'form', 'input[type="submit"]', 'input[type="button"]', 
            'dialog', '[role="dialog"]', '[role="alert"]', '[role="banner"]',
            '.modal', '.banner', '.popup'
        ].join(', ');
    }

    /**
     * Initializes the scanner and starts observing the DOM.
     */
    start() {
        console.log("🛡️ Sentinel: DOM Scanner initialized and monitoring.");
        
        // 1. Scan the initial static DOM
        this.scanSubtree(document.body);

        // 2. Set up MutationObserver for dynamically added elements (like ad blockers)
        const observer = new MutationObserver((mutations) => {
            let DOMChanged = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        // Only process element nodes (ignore text/comment nodes)
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.scanSubtree(node);
                            DOMChanged = true;
                        }
                    });
                }
            });

            // If new target elements were found, schedule a batch send
            if (DOMChanged && this.elementBatch.length > 0) {
                this.debounceBatch();
            }
        });

        // Observe the entire document body for deep changes
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }

    /**
     * Recursively scans a DOM node and its children for target elements.
     * @param {HTMLElement} rootNode 
     */
    scanSubtree(rootNode) {
        // Check if the root node itself is a target
        if (rootNode.matches && rootNode.matches(this.TARGET_SELECTORS)) {
            this.processElement(rootNode);
        }

        // Check all children matching our targets
        if (rootNode.querySelectorAll) {
            const targets = rootNode.querySelectorAll(this.TARGET_SELECTORS);
            targets.forEach(element => this.processElement(element));
        }
    }

    /**
     * Extracts text, checks the cache, and adds valid elements to the batch.
     * @param {HTMLElement} element 
     */
    processElement(element) {
        // Temporarily relaxed visibility check to ensure elements on local file:// pages are processed.
        // if (element.offsetParent === null) return;

        // Extract visible text (innerText) or value/placeholder for inputs
        let text = element.innerText || element.value || element.placeholder || '';
        text = text.trim().replace(/\s+/g, ' '); // Clean whitespace

        console.log(`[processElement] Found <${element.tagName}> | Raw Text: "${text}"`);

        // Filter out empty or irrelevant text
        if (text.length < this.MIN_TEXT_LENGTH) {
            console.log(`  -> Filtered: Too short (< ${this.MIN_TEXT_LENGTH} chars)`);
            return;
        }
        if (text.length > this.MAX_TEXT_LENGTH) {
            console.log(`  -> Filtered: Too long (> ${this.MAX_TEXT_LENGTH} chars)`);
            return;
        }

        // Cache Check (Avoid duplicate scanning)
        const hash = this._hashString(text);
        if (this.scannedHashes.has(hash)) {
            console.log(`  -> Filtered: Already cached`);
            return;
        }
        this.scannedHashes.add(hash);

        console.log(`  ✅ Added to batch!`);

        // Generate a unique ID to map the backend response back to this DOM element
        const elementId = 'sentinel-elem-' + Math.random().toString(36).substr(2, 9);
        element.dataset.sentinelId = elementId;
        this.nodeMap.set(elementId, element);

        // Add to the current batch as structured JSON
        this.elementBatch.push({
            id: elementId,
            text: text,
            tagName: element.tagName.toLowerCase(),
            type: element.type || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });

        // Ensure every newly added element triggers the debounce timer
        this.debounceBatch();
    }

    /**
     * Debounces the network/processing step.
     * Resets the timer every time the DOM mutates, ensuring we only process
     * when the page has settled (low CPU usage).
     */
    debounceBatch() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        console.log(`⏱️ [debounceBatch] Timer reset. Waiting ${this.DEBOUNCE_DELAY_MS}ms...`);

        this.batchTimeout = setTimeout(() => {
            console.log(`⏱️ [debounceBatch] Timer expired! Executing flushBatch().`);
            this.flushBatch();
        }, this.DEBOUNCE_DELAY_MS);
    }

    /**
     * Processes the batch and resets it.
     */
    flushBatch() {
        if (this.elementBatch.length === 0) {
            console.log("⚠️ [flushBatch] Batch is empty, nothing to send.");
            return;
        }

        const batchToSend = [...this.elementBatch];
        this.elementBatch = []; // Reset batch for next mutations

        console.group("🚀 Sentinel: Sending Payload to Background");
        console.log(`Sending batch of ${batchToSend.length} elements.`);
        console.log("Payload:", { action: "analyze", payload: { elements: batchToSend } });
        console.groupEnd();

        try {
            chrome.runtime.sendMessage(
                { action: "analyze", payload: { elements: batchToSend } },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("❌ Sentinel Background Unreachable:", chrome.runtime.lastError.message);
                        return;
                    }
                    
                    console.group("📥 Sentinel: Background Response Received");
                    console.log("Response data:", response);
                    console.groupEnd();

                    if (response && response.results) {
                        this.handleResults(response.results);
                    } else if (response && response.error) {
                        console.error("🛡️ Sentinel Background Error:", response.error);
                    }
                }
            );
        } catch (err) {
            console.error("❌ Exception during sendMessage:", err);
        }
    }

    /**
     * Process results from the backend and apply highlights.
     * @param {Array} results 
     */
    handleResults(results) {
        if (!window.SentinelUIManager) {
            console.error("🚨 SentinelUIManager not found! Check if content/ui_manager.js is injected.");
            return;
        }

        console.group("🚨 Sentinel: Detection Results");
        if (results.length === 0) {
            console.log("✅ No dark patterns or phishing detected in this batch.");
        } else {
            console.warn(`⚠️ Detected ${results.length} suspicious elements!`);
            results.forEach(result => {
                const element = this.nodeMap.get(result.id);
                if (element && (result.is_dark_pattern || result.is_phishing)) {
                    console.log(`Applying ${result.is_phishing ? 'Phishing' : 'Dark Pattern'} highlight to:`, element);
                    console.log(`Reason: ${result.explanation} (Confidence: ${result.is_phishing ? result.phishing_conf : result.dark_pattern_conf})`);
                    
                    window.SentinelUIManager.highlightElement(element, result);
                } else {
                    console.error("❌ Element not found in nodeMap for ID:", result.id);
                }
                // Memory cleanup
                this.nodeMap.delete(result.id);
            });
        }
        console.groupEnd();
    }

    /**
     * Fast 32-bit integer hashing for text strings.
     * @param {string} str 
     * @returns {number}
     */
    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}

// Initialize when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.SentinelScanner = new SentinelDOMScanner();
        window.SentinelScanner.start();
    });
} else {
    window.SentinelScanner = new SentinelDOMScanner();
    window.SentinelScanner.start();
}
