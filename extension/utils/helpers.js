console.log("🛠️ [Sentinel Utils] Initializing helpers module...");

class SentinelHelpers {
    /**
     * Generates a unique ID for elements.
     * @param {string} prefix 
     * @returns {string}
     */
    static generateId(prefix = 'sentinel') {
        return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleans text by removing excessive whitespace.
     * @param {string} text 
     * @returns {string}
     */
    static cleanText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    }
}

window.SentinelHelpers = SentinelHelpers;
console.log("✅ [Sentinel Utils] Helpers module initialized.");
