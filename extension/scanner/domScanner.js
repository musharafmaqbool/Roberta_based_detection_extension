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
        
        // WeakSet to track all processed elements/containers and prevent duplicates
        this.processedNodes = new WeakSet();
        
        this.TARGET_SELECTORS = [
            'a', 'button', 'form', 'input[type="submit"]', 'input[type="button"]',
            'dialog', '[role="dialog"]', '[role="alert"]', '[role="banner"]',
            '.modal', '.banner', '.popup',
            // Dark pattern content elements: paragraphs, divs, spans with inline text
            'p', 'div.banner', 'div.offer', 'div.promo', 'div.warning',
            'span.urgent', 'span.promo', 'span.offer'
        ].join(', ');
        
        console.log("🔍 [Sentinel Scanner] DOM scanner created.");
    }

    /**
     * Helper to verify if an element is part of Sentinel UI to prevent infinite loops.
     * @param {HTMLElement} node
     * @returns {boolean}
     */
    isSentinelElement(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
        
        let current = node;
        while (current && current !== document.body && current !== document.documentElement) {
            if (current.id && typeof current.id === 'string' && current.id.toLowerCase().includes('sentinel')) {
                return true;
            }
            if (current.className && typeof current.className === 'string' && current.className.toLowerCase().includes('sentinel')) {
                return true;
            }
            if (current.dataset && (current.dataset.sentinelId || current.dataset.sentinelPhishingContainer)) {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Initializes the scanner and starts observing the DOM.
     * @param {Function} onResultsCallback 
     */
    start(onResultsCallback) {
        console.log("🛡️ [Sentinel Scanner] DOM Scanner initialized and monitoring.");
        
        // 1. Scan the initial static DOM
        this.scanSubtree(document.body, onResultsCallback);

        // 2. Set up MutationObserver for dynamically added/removed elements
        const observer = new MutationObserver((mutations) => {
            let DOMChanged = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Skip Sentinel UI nodes to prevent scanning loops
                                if (this.isSentinelElement(node)) {
                                    return;
                                }
                                this.scanSubtree(node, onResultsCallback);
                                DOMChanged = true;
                            }
                        });
                    }
                    if (mutation.removedNodes.length > 0) {
                        mutation.removedNodes.forEach((node) => {
                            this.cleanRemovedNode(node);
                        });
                    }
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
     * Safely cleans up deleted DOM nodes from the nodeMap.
     * @param {Node} node 
     */
    cleanRemovedNode(node) {
        if (!node) return;
        
        // 1. Clean the node itself if it has a sentinel ID
        if (node.dataset && node.dataset.sentinelId) {
            const id = node.dataset.sentinelId;
            if (this.nodeMap.has(id)) {
                this.nodeMap.delete(id);
                console.log(`🧹 [Sentinel Scanner] Cleaned removed node ID: ${id}`);
            }
        }
        
        // 2. Clean all children with sentinel IDs
        if (node.querySelectorAll) {
            try {
                const children = node.querySelectorAll('[data-sentinel-id]');
                children.forEach(child => {
                    const id = child.dataset.sentinelId;
                    if (id && this.nodeMap.has(id)) {
                        this.nodeMap.delete(id);
                        console.log(`🧹 [Sentinel Scanner] Cleaned removed child node ID: ${id}`);
                    }
                });
            } catch (e) {
                // Ignore querySelectorAll exceptions on fragmented elements
            }
        }
    }

    /**
     * Recursively scans a DOM node and its children for target elements.
     * @param {HTMLElement} rootNode 
     * @param {Function} onResultsCallback 
     */
    scanSubtree(rootNode, onResultsCallback) {
        if (!rootNode) return;
        
        // Skip Sentinel-owned elements to prevent batch loops
        if (this.isSentinelElement(rootNode)) {
            console.log("🔍 [Sentinel DOMScanner] [CONTAINER SKIPPED] Skipping Sentinel UI element subtree:", rootNode);
            return;
        }

        // 1. Scan and process form containers first
        const containers = this.findFormContainers(rootNode);
        containers.forEach(container => this.processPhishingContainer(container, onResultsCallback));

        // 2. Check if the root node itself is a target
        if (rootNode.matches && rootNode.matches(this.TARGET_SELECTORS)) {
            this.processElement(rootNode, onResultsCallback);
        }

        // 3. Check all children matching our targets
        if (rootNode.querySelectorAll) {
            const targets = rootNode.querySelectorAll(this.TARGET_SELECTORS);
            targets.forEach(element => this.processElement(element, onResultsCallback));
        }
    }

    /**
     * Finds form containers (standard forms and non-form card containers wrapping inputs/buttons) within the subtree.
     * @param {HTMLElement} rootNode
     * @returns {HTMLElement[]}
     */
    findFormContainers(rootNode) {
        const containers = new Set();
        if (!rootNode) return [];

        // 1. If rootNode itself is a form
        if (rootNode.tagName && rootNode.tagName.toLowerCase() === 'form') {
            containers.add(rootNode);
        }

        // 2. Query all forms inside rootNode
        if (rootNode.querySelectorAll) {
            rootNode.querySelectorAll('form').forEach(form => containers.add(form));
        }

        // 3. Find non-form container elements that wrap credential inputs and action buttons
        const queryRoot = rootNode.querySelectorAll ? rootNode : document;
        const passwordInputs = queryRoot.querySelectorAll ? queryRoot.querySelectorAll('input[type="password"]') : [];
        passwordInputs.forEach(input => {
            const form = input.closest('form');
            if (form) {
                containers.add(form);
            } else {
                let parent = input.parentElement;
                while (parent && parent !== document.body && parent !== document.documentElement) {
                    const hasButton = parent.querySelector('button, input[type="submit"], input[type="button"]');
                    if (hasButton) {
                        containers.add(parent);
                        break;
                    }
                    parent = parent.parentElement;
                }
                if (parent === document.body || !parent) {
                    containers.add(input.parentElement || input);
                }
            }
        });

        // 4. Query text/email inputs with credential keywords if no password input is found
        const otherInputs = queryRoot.querySelectorAll ? queryRoot.querySelectorAll('input[type="email"], input[name*="pass"], input[name*="user"], input[name*="login"], input[id*="pass"], input[id*="user"], input[placeholder*="password" i], input[placeholder*="email" i], input[placeholder*="login" i]') : [];
        otherInputs.forEach(input => {
            const form = input.closest('form');
            if (form) {
                containers.add(form);
            } else {
                let parent = input.parentElement;
                while (parent && parent !== document.body && parent !== document.documentElement) {
                    const hasButton = parent.querySelector('button, input[type="submit"], input[type="button"]');
                    if (hasButton) {
                        containers.add(parent);
                        break;
                    }
                    parent = parent.parentElement;
                }
                if (parent === document.body || !parent) {
                    containers.add(input.parentElement || input);
                }
            }
        });

        return Array.from(containers);
    }

    /**
     * Extracts and merges headings, paragraphs, labels, placeholders, buttons, and surrounding text of a container.
     * @param {HTMLElement} container
     * @returns {string}
     */
    extractFormContext(container) {
        const textParts = [];

        // 1. Heading text
        container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            const text = h.innerText.trim();
            if (text) textParts.push(text);
        });

        // 2. Paragraphs, labels, spans
        container.querySelectorAll('p, label, span, li').forEach(p => {
            const text = p.innerText.trim();
            if (text && !textParts.includes(text)) textParts.push(text);
        });

        // 3. Input placeholders and names
        container.querySelectorAll('input').forEach(input => {
            if (input.placeholder) {
                textParts.push(`[Input Placeholder: ${input.placeholder.trim()}]`);
            }
            if (input.name) {
                textParts.push(`[Input Name: ${input.name.trim()}]`);
            }
            if (input.value) {
                textParts.push(`[Input Value: ${input.value.trim()}]`);
            }
        });

        // 4. Button text
        container.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(btn => {
            const text = (btn.innerText || btn.value || '').trim();
            if (text) textParts.push(`[Button: ${text}]`);
        });

        // Combine into a single text block
        const mergedText = textParts.join('\n');
        
        // Explicit Debug Log [FORM CONTEXT EXTRACTED]
        console.log("🔍 [Sentinel Scanner] [FORM CONTEXT EXTRACTED] context:", mergedText);
        
        return mergedText;
    }

    /**
     * Processes a form container for phishing analysis.
     * @param {HTMLElement} container
     * @param {Function} onResultsCallback
     */
    processPhishingContainer(container, onResultsCallback) {
        if (!container) return;

        // Skip if this container was already scanned/processed
        if (container.dataset.sentinelPhishingContainer === "true" || this.processedNodes.has(container)) {
            console.log("🔍 [Sentinel DOMScanner] [CONTAINER SKIPPED] already processed container in scan.");
            return;
        }

        // Mark container as processed and add to WeakSet
        container.dataset.sentinelPhishingContainer = "true";
        this.processedNodes.add(container);

        console.warn("🚨 [Sentinel Scanner] [PHISHING CONTAINER ISOLATED] isolating phishing container for unified context scan:", container);

        let text = this.extractFormContext(container);
        text = this.helpers.cleanText(text);

        // Filter out empty or extremely short/long text (phishing context has a larger max length limit)
        if (text.length < this.MIN_TEXT_LENGTH || text.length > 2000) {
            return;
        }

        // Cache Check (Avoid duplicate scanning)
        const hash = this.hashing.hashString(text);
        if (this.scannedHashes.has(hash)) {
            return;
        }
        this.scannedHashes.add(hash);

        // Run local phishing heuristic logs check
        const lowerText = text.toLowerCase();
        const hasUrgency = /verify immediately|account suspended|urgent action|confirm identity|claim reward|login to secure|immediate action|unauthorized|action required|security alert/i.test(lowerText);
        const hasSuspension = /suspension|suspended|suspend|deactivated|blocked|restricted/i.test(lowerText);
        const hasCredentials = /password|email|username|login|credential/i.test(lowerText);
        if (hasUrgency || hasSuspension || hasCredentials) {
            console.warn("🚨 [Sentinel Scanner] [PHISHING HEURISTIC TRIGGERED] local heuristic pattern matches in form context!");
        }

        // Generate unique ID and link to node map, ensuring safety
        let elementId = container.dataset.sentinelId;
        if (elementId && this.nodeMap.has(elementId)) {
            console.log(`🔍 [Sentinel Scanner] [DUPLICATE NODE BLOCKED] Container already mapped with ID: ${elementId}`);
            return;
        }

        if (!elementId) {
            elementId = this.helpers.generateId();
            container.dataset.sentinelId = elementId;
        }
        
        this.nodeMap.set(elementId, container);

        // Add to batch
        this.batching.add({
            id: elementId,
            text: text,
            tagName: container.tagName.toLowerCase(),
            type: null,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });

        this.batching.debounce(onResultsCallback);
    }

    /**
     * Extracts text, checks the cache, and adds valid elements to the batch.
     * @param {HTMLElement} element 
     * @param {Function} onResultsCallback 
     */
    processElement(element, onResultsCallback) {
        if (!element) return;

        // Skip if this element is part of Sentinel UI
        if (this.isSentinelElement(element)) {
            return;
        }

        // 1. Prevent nested scanning conflicts:
        // Skip credential input/submit elements that were already folded into a phishing
        // container context scan. However, allow dark-pattern-indicative elements (buttons
        // with manipulative text, p/div/span elements) to still be independently evaluated
        // so they are not silently dropped on combined pages.
        const associatedContainer = element.closest('[data-sentinel-phishing-container]');
        if (associatedContainer) {
            const tag = element.tagName.toLowerCase();
            const isCredentialElement = (
                tag === 'input' ||
                tag === 'form' ||
                (tag === 'button' && (
                    element.type === 'submit' ||
                    /verify|login|confirm|unlock|restore|secure|validate/i.test(element.innerText || '')
                ))
            );
            if (isCredentialElement) {
                console.log("🔍 [Sentinel DOMScanner] [CONTAINER SKIPPED] Skipping credential element already in phishing container:", element);
                return;
            }
            // Non-credential elements (dark pattern buttons/paragraphs) continue below
            console.log("🔍 [Sentinel DOMScanner] [DARK PATTERN CHECK] Non-credential element inside container, allowing independent scan:", element);
        }

        // 2. Prevent scanning duplicate elements using the WeakSet
        if (this.processedNodes.has(element)) {
            console.log("🔍 [Sentinel DOMScanner] [DUPLICATE NODE BLOCKED] already scanned element.");
            return;
        }

        // Skip if this element is already mapped under the same sentinelId in nodeMap
        if (element.dataset.sentinelId && this.nodeMap.has(element.dataset.sentinelId)) {
            console.log("🔍 [Sentinel DOMScanner] [DUPLICATE NODE BLOCKED] Element already in nodeMap:", element.dataset.sentinelId);
            return;
        }

        this.processedNodes.add(element);

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

        // Generate unique ID and link to node map, ensuring safety
        let elementId = element.dataset.sentinelId;
        if (elementId && this.nodeMap.has(elementId)) {
            console.log("🔍 [Sentinel Scanner] [DUPLICATE NODE BLOCKED] ID already exists in nodeMap:", elementId);
            return;
        }

        if (!elementId) {
            elementId = this.helpers.generateId();
            element.dataset.sentinelId = elementId;
        }
        
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
