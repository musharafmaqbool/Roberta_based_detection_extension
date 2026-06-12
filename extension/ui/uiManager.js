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
            return; // Safe or Medium/Low risk, no highlight needed
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

        const isPhish = prediction.is_phishing;
        const themeClass = isPhish ? 'theme-phish' : 'theme-dp';
        const threatType = isPhish ? 'Phishing' : 'Dark Pattern';

        const explanation = prediction.explanation || "Deceptive pattern detected.";
        const conf = isPhish ? prediction.phishing_conf : prediction.dark_pattern_conf;
        const confidenceStr = Math.round(conf * 100) + '% Confidence';
        const category = prediction.category || 'Unknown';

        // Determine severity display based on risk level and confidence
        let severity = 'LOW';
        if (isPhish) {
            if (prediction.phishing_risk_level === 'High Risk') {
                severity = conf >= 0.98 ? 'CRITICAL' : 'HIGH';
            } else if (prediction.phishing_risk_level === 'Medium Risk') {
                severity = 'MEDIUM';
            } else {
                severity = 'LOW';
            }
        } else {
            if (conf >= 0.98) severity = 'CRITICAL';
            else if (conf >= 0.95) severity = 'HIGH';
            else if (conf >= 0.85) severity = 'MEDIUM';
        }

        this.tooltipElement.innerHTML = `
            <div class="sentinel-tt-header">
                <div class="sentinel-tt-title">
                    <span class="sentinel-pulse-dot"></span>
                    ${title}
                </div>
                <div class="sentinel-tt-badges">
                    <span class="sentinel-badge severity-${severity.toLowerCase()}">${severity}</span>
                    <span class="sentinel-badge conf-badge">${confidenceStr}</span>
                </div>
            </div>
            <div class="sentinel-tt-body">
                <div class="sentinel-tt-row">
                    <span class="sentinel-tt-label">CATEGORY</span>
                    <span class="sentinel-tt-value">${threatType}</span>
                </div>
                <div class="sentinel-tt-row">
                    <span class="sentinel-tt-label">AI ANALYSIS</span>
                    <span class="sentinel-tt-value monospace">${explanation}</span>
                </div>
                <div class="sentinel-tt-progress-bg">
                    <div class="sentinel-tt-progress-fill" style="width: ${conf * 100}%"></div>
                </div>
            </div>
            <div class="sentinel-tt-footer">
                <span>🛡 Analyzed by Sentinel AI</span>
                <span class="sentinel-tt-time">LIVE</span>
            </div>
        `;

        // Position the tooltip intelligently
        const rect = event.target.getBoundingClientRect();
        let top = window.scrollY + rect.bottom + 10;
        let left = window.scrollX + rect.left;

        // Prevent overflow off-screen
        const tooltipWidth = 320; // Fixed width defined in CSS
        if (rect.left + tooltipWidth > window.innerWidth) {
            left = window.scrollX + window.innerWidth - tooltipWidth - 20; // Right boundary padding
        }

        // Check vertical overflow (if too close to bottom, show above element)
        // Assume approximate height of tooltip is 200px
        const tooltipHeight = 200;
        if (rect.bottom + tooltipHeight + 10 > window.innerHeight && rect.top > tooltipHeight + 10) {
            top = window.scrollY + rect.top - tooltipHeight - 10;
        }

        this.tooltipElement.style.top = `${top}px`;
        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.className = `sentinel-tooltip sentinel-tooltip-visible ${themeClass}`;
        
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
