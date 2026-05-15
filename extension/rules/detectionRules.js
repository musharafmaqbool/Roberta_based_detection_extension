console.log("📜 [Sentinel Rules] Initializing detection rules module...");

export const DARK_PATTERN_KEYWORDS = [
    "hurry", "only a few left", "offer ends in", "act fast",
    "no thanks", "prefer paying full price", "skip this exclusive offer",
    "people are viewing this", "just bought this", "must agree", "required to continue"
];

export const PHISHING_KEYWORDS = [
    "verify your account", "update your billing", "account suspended", 
    "login immediately", "claim your prize", "click here to secure",
    "password expired", "unusual sign-in activity"
];

/**
 * Local heuristic detection for deceptive patterns.
 * @param {string} text 
 * @returns {Object|null}
 */
export function localAnalyze(text) {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    
    for (let word of PHISHING_KEYWORDS) {
        if (lowerText.includes(word)) {
            console.log(`📜 [Sentinel Rules] Phishing match found: '${word}'`);
            return {
                is_phishing: true, phishing_conf: 0.95,
                is_dark_pattern: false, dark_pattern_conf: 0,
                category: "Social Engineering",
                explanation: `Local Rule Match: Contains suspicious phrase '${word}'`
            };
        }
    }

    for (let word of DARK_PATTERN_KEYWORDS) {
        if (lowerText.includes(word)) {
            console.log(`📜 [Sentinel Rules] Dark pattern match found: '${word}'`);
            return {
                is_phishing: false, phishing_conf: 0,
                is_dark_pattern: true, dark_pattern_conf: 0.85,
                category: "Manipulative Language",
                explanation: `Local Rule Match: Contains manipulative phrase '${word}'`
            };
        }
    }

    return null; 
}

console.log("✅ [Sentinel Rules] Detection rules initialized.");
