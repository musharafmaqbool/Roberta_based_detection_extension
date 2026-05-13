/**
 * Cache module to prevent re-scanning the same DOM elements.
 * Keeps the extension lightweight.
 */
class ScannerCache {
    constructor() {
        this.scannedHashes = new Set();
    }

    /**
     * Simple hash function for text strings.
     * @param {string} text 
     * @returns {number}
     */
    _hashString(text) {
        let hash = 0;
        if (text.length === 0) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    /**
     * Checks if text has already been scanned.
     * @param {string} text 
     * @returns {boolean}
     */
    has(text) {
        if (!text) return true;
        const hash = this._hashString(text.trim());
        return this.scannedHashes.has(hash);
    }

    /**
     * Adds text to the cache.
     * @param {string} text 
     */
    add(text) {
        if (!text) return;
        const hash = this._hashString(text.trim());
        this.scannedHashes.add(hash);
    }

    /**
     * Clears the cache.
     */
    clear() {
        this.scannedHashes.clear();
    }
}

// Attach to window for global access in content script scope
window.SentinelCache = new ScannerCache();
