console.log("🛠️ [Sentinel Utils] Initializing hashing module...");

class SentinelHashing {
    /**
     * Fast 32-bit integer hashing for text strings.
     * @param {string} text 
     * @returns {number}
     */
    static hashString(text) {
        let hash = 0;
        if (!text || text.length === 0) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
}

window.SentinelHashing = SentinelHashing;
console.log("✅ [Sentinel Utils] Hashing module initialized.");
