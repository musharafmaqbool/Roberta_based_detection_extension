console.log("🔍 [Sentinel Scanner] Initializing DOM scanner module...");

class SentinelDOMScanner {
    constructor(batchingService, helpersService, hashingService) {
        this.batching = batchingService;
        this.helpers = helpersService;
        this.hashing = hashingService;
        
        this.MIN_TEXT_LENGTH = 5;
        this.MAX_TEXT_LENGTH = 400;
        this.scannedHashes = new Set();
        this.nodeMap = new Map();
        
        this.TARGET_SELECTORS = [
            'a', 'button', 'form', 'input[type="submit"]', 'input[type="button"]', 
            'dialog', '[role="dialog"]', '[role="alert"]', '[role="banner"]',
            '.modal', '.banner', '.popup'
        ].join(', ');
        
        console.log("🔍 [Sentinel Scanner] DOM scanner created.");
    }

    /**
     * Initializes the scanner and starts observing the DOM.
     * @param {Function} onResultsCallback 
     */
    start(onResultsCallback) {
        console.log("🛡️ [Sentinel Scanner] DOM Scanner initialized and monitoring.");
        
        // 1. Scan the initial static DOM
        this.scanSubtree(document.body, onResultsCallback);

        // 2. Set up MutationObserver for dynamically added elements
        const observer = new MutationObserver((mutations) => {
            let DOMChanged = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        // Only process element nodes
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.scanSubtree(node, onResultsCallback);
                            DOMChanged = true;
                        }
                    });
                }
            });

            // If new target elements were found, schedule a batch send
            if (DOMChanged) {
                this.batching.debounce(onResultsCallback);
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
     * @param {Function} onResultsCallback 
     */
    scanSubtree(rootNode, onResultsCallback) {
        // Check if the root node itself is a target
        if (rootNode.matches && rootNode.matches(this.TARGET_SELECTORS)) {
            this.processElement(rootNode, onResultsCallback);
        }

        // Check all children matching our targets
        if (rootNode.querySelectorAll) {
            const targets = rootNode.querySelectorAll(this.TARGET_SELECTORS);
            targets.forEach(element => this.processElement(element, onResultsCallback));
        }
    }

    /**
     * Extracts text, checks the cache, and adds valid elements to the batch.
     * @param {HTMLElement} element 
     * @param {Function} onResultsCallback 
     */
    processElement(element, onResultsCallback) {
        let text = element.innerText || element.value || element.placeholder || '';
        text = this.helpers.cleanText(text);

        // Filter out empty or irrelevant text
        if (text.length < this.MIN_TEXT_LENGTH || text.length > this.MAX_TEXT_LENGTH) {
            return;
        }

        // Cache Check (Avoid duplicate scanning)
        const hash = this.hashing.hashString(text);
        if (this.scannedHashes.has(hash)) {
            return;
        }
        this.scannedHashes.add(hash);

        // Generate a unique ID to map the backend response back to this DOM element
        const elementId = this.helpers.generateId();
        element.dataset.sentinelId = elementId;
        this.nodeMap.set(elementId, element);

        // Add to the current batch as structured JSON
        this.batching.add({
            id: elementId,
            text: text,
            tagName: element.tagName.toLowerCase(),
            type: element.type || null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });

        // Ensure every newly added element triggers the debounce timer
        this.batching.debounce(onResultsCallback);
    }

    /**
     * Retrieves the DOM element by its generated ID.
     * @param {string} id 
     * @returns {HTMLElement|undefined}
     */
    getNode(id) {
        return this.nodeMap.get(id);
    }
    
    /**
     * Removes the reference to a DOM element to free memory.
     * @param {string} id 
     */
    removeNode(id) {
        this.nodeMap.delete(id);
    }
}

window.SentinelDOMScanner = SentinelDOMScanner;
console.log("✅ [Sentinel Scanner] DOM scanner module initialized.");
