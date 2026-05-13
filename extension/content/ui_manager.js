/**
 * UIManager handles adding visual borders and tooltips to the DOM.
 */
class UIManager {
    constructor() {
        this.tooltipElement = null;
        this._initTooltip();
    }

    /**
     * Initializes the tooltip container in the DOM.
     */
    _initTooltip() {
        if (!document.getElementById('sentinel-tooltip')) {
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.id = 'sentinel-tooltip';
            this.tooltipElement.className = 'sentinel-tooltip-hidden';
            document.body.appendChild(this.tooltipElement);
        } else {
            this.tooltipElement = document.getElementById('sentinel-tooltip');
        }
    }

    /**
     * Highlights an element based on the prediction.
     * @param {HTMLElement} element 
     * @param {Object} prediction 
     */
    highlightElement(element, prediction) {
        // Remove existing classes just in case
        element.classList.remove('sentinel-dark-pattern', 'sentinel-phishing');

        let severityClass = '';
        let title = '';

        if (prediction.is_phishing) {
            severityClass = 'sentinel-phishing';
            title = 'Phishing Alert';
        } else if (prediction.is_dark_pattern) {
            severityClass = 'sentinel-dark-pattern';
            title = 'Dark Pattern Alert';
        } else {
            return; // Safe, no highlight needed
        }

        element.classList.add(severityClass);

        // Add event listeners for tooltip
        element.addEventListener('mouseenter', (e) => this.showTooltip(e, title, prediction));
        element.addEventListener('mouseleave', () => this.hideTooltip());
    }

    /**
     * Shows the tooltip with explanation.
     */
    showTooltip(event, title, prediction) {
        if (!this.tooltipElement) return;

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

window.SentinelUIManager = new UIManager();
