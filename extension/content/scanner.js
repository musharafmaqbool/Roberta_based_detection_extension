/**
 * Scanner module to parse the DOM, observe mutations, and send batches to the backend.
 */
class DOMScanner {
    constructor() {
        this.batch = [];
        this.batchTimeout = null;
        this.elementMap = new Map(); // Maps generated IDs to DOM elements
        this.cache = window.SentinelCache;
        this.uiManager = window.SentinelUIManager;
        this.isActive = true; // Controlled by popup

        this.TARGET_TAGS = ['A', 'BUTTON', 'INPUT', 'FORM', 'SPAN', 'DIV'];
        
        // Listen for toggle messages from background/popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "toggle_status") {
                this.isActive = request.isActive;
                if (!this.isActive) {
                    // Turn off scanning and clear borders (optional enhancement)
                }
            }
        });
    }

    /**
     * Start observing the document for changes.
     */
    start() {
        this.scanNode(document.body);

        const observer = new MutationObserver((mutations) => {
            if (!this.isActive) return;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        this.scanNode(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Scan a specific node and its children.
     * @param {HTMLElement} node 
     */
    scanNode(node) {
        if (!this.isActive) return;

        // Ensure the node has a tagName
        if (!node.tagName) return;

        // Skip our own tooltips to avoid infinite loops
        if (node.id === 'sentinel-tooltip') return;

        if (this.TARGET_TAGS.includes(node.tagName)) {
            this.processElement(node);
        }

        const children = node.querySelectorAll(this.TARGET_TAGS.join(', '));
        children.forEach(child => this.processElement(child));
    }

    /**
     * Process an individual element, extracting text and adding to batch.
     * @param {HTMLElement} element 
     */
    processElement(element) {
        // Skip hidden elements
        if (element.offsetParent === null) return;

        const text = element.innerText || element.value || element.placeholder || '';
        const cleanText = text.trim();

        if (cleanText.length < 5 || cleanText.length > 300) return; // Ignore very short or very long text
        if (this.cache.has(cleanText)) return; // Already scanned

        // Mark as scanned
        this.cache.add(cleanText);

        // Generate a unique ID for this element so we can map the result back
        const id = 'sentinel-' + Math.random().toString(36).substr(2, 9);
        element.dataset.sentinelId = id;
        this.elementMap.set(id, element);

        this.batch.push({
            id: id,
            text: cleanText,
            tagName: element.tagName,
            url: window.location.href
        });

        this.scheduleBatchSend();
    }

    /**
     * Debounce sending the batch to the background script.
     */
    scheduleBatchSend() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.sendBatch();
        }, 1000); // Send batch every 1 second of inactivity
    }

    /**
     * Send the batch to the background script.
     */
    sendBatch() {
        if (this.batch.length === 0) return;

        const currentBatch = [...this.batch];
        this.batch = [];

        chrome.runtime.sendMessage(
            { action: "analyze", payload: { elements: currentBatch } },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Sentinel:", chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.results) {
                    this.handleResults(response.results);
                }
            }
        );
    }

    /**
     * Process results from the backend and apply highlights.
     * @param {Array} results 
     */
    handleResults(results) {
        results.forEach(result => {
            const element = this.elementMap.get(result.id);
            if (element && (result.is_dark_pattern || result.is_phishing)) {
                this.uiManager.highlightElement(element, result);
            }
            // Clean up memory
            this.elementMap.delete(result.id);
        });
    }
}

window.SentinelScanner = new DOMScanner();
