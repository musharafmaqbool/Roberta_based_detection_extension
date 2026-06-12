console.log("🎨 [Sentinel UI] Initializing highlights module...");

class SentinelHighlights {
    /**
     * Applies the appropriate highlighting class based on prediction.
     * @param {HTMLElement} element 
     * @param {Object} prediction 
     * @returns {string} The severity class applied, or empty string if none.
     */
    static applyHighlight(element, prediction) {
        // Remove existing classes just in case
        element.classList.remove('sentinel-dark-pattern', 'sentinel-phishing');

        let severityClass = '';

        // Only visually highlight phishing if it is flagged as phishing and has High Risk level
        if (prediction.is_phishing && prediction.phishing_risk_level === 'High Risk') {
            severityClass = 'sentinel-phishing';
        } else if (prediction.is_dark_pattern) {
            severityClass = 'sentinel-dark-pattern';
        }

        if (severityClass) {
            element.classList.add(severityClass);
            console.log(`🎨 [Sentinel Highlights] Applied '${severityClass}' to element:`, element);
        }

        return severityClass;
    }

    /**
     * Removes all sentinel highlight classes from an element.
     * @param {HTMLElement} element 
     */
    static removeHighlight(element) {
        element.classList.remove('sentinel-dark-pattern', 'sentinel-phishing');
        console.log("🎨 [Sentinel Highlights] Removed highlights from element:", element);
    }
}

window.SentinelHighlights = SentinelHighlights;
console.log("✅ [Sentinel UI] Highlights module initialized.");
