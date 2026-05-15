console.log("🖥️ [Sentinel UI] Initializing UIManager module...");

class SentinelUIManager {
    constructor() {
        this.tooltipElement = null;
        this.highlights = window.SentinelHighlights;
        console.log("🖥️ [Sentinel UI] UIManager instance created.");
    }

    /**
     * Initializes the tooltip container in the DOM.
     */
    init() {
        console.log("🖥️ [Sentinel UI] Initializing tooltip DOM element...");
        if (!document.getElementById('sentinel-tooltip')) {
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.id = 'sentinel-tooltip';
            this.tooltipElement.className = 'sentinel-tooltip-hidden';
            document.body.appendChild(this.tooltipElement);
            console.log("🖥️ [Sentinel UI] Tooltip element appended to body.");
        } else {
            this.tooltipElement = document.getElementById('sentinel-tooltip');
            console.log("🖥️ [Sentinel UI] Found existing tooltip element.");
        }
    }

    /**
     * Processes an element and sets up highlighting and tooltips if malicious.
     * @param {HTMLElement} element 
     * @param {Object} prediction 
     */
    processElement(element, prediction) {
        const severityClass = this.highlights.applyHighlight(element, prediction);
        
        if (!severityClass) {
            return; // Safe, no highlight needed
        }

        const title = prediction.is_phishing ? 'Phishing Alert' : 'Dark Pattern Alert';

        // Add event listeners for tooltip
        element.addEventListener('mouseenter', (e) => this.showTooltip(e, title, prediction));
        element.addEventListener('mouseleave', () => this.hideTooltip());
        
        console.log(`🖥️ [Sentinel UI] Registered tooltip events for: ${title}`);
    }

    /**
     * Shows the tooltip with explanation.
     */
    showTooltip(event, title, prediction) {
        if (!this.tooltipElement) {
            console.warn("⚠️ [Sentinel UI] Tooltip element not initialized!");
            return;
        }

        const explanation = prediction.explanation || "Deceptive pattern detected.";
        const conf = prediction.is_phishing ? prediction.phishing_conf : prediction.dark_pattern_conf;
        const confidenceStr = Math.round(conf * 100) + '% Confidence';
        const category = prediction.category || 'Unknown';

        this.tooltipElement.innerHTML = `
            <div class="sentinel-tooltip-header ${prediction.is_phishing ? 'phish' : 'dp'}">${title}</div>
            <div class="sentinel-tooltip-body">
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Reason:</strong> ${explanation}</p>
            </div>
            <div class="sentinel-tooltip-footer">${confidenceStr}</div>
        `;

        // Position the tooltip
        const rect = event.target.getBoundingClientRect();
        this.tooltipElement.style.top = `${window.scrollY + rect.bottom + 10}px`;
        this.tooltipElement.style.left = `${window.scrollX + rect.left}px`;
        this.tooltipElement.className = 'sentinel-tooltip-visible';
        
        console.log("🖥️ [Sentinel UI] Displaying tooltip at", this.tooltipElement.style.top, this.tooltipElement.style.left);
    }

    /**
     * Hides the tooltip.
     */
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.className = 'sentinel-tooltip-hidden';
        }
    }
}

window.SentinelUIManager = SentinelUIManager;
console.log("✅ [Sentinel UI] UIManager module initialized.");
