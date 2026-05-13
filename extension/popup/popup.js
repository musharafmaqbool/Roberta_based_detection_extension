document.addEventListener('DOMContentLoaded', () => {
    const riskArc = document.getElementById('risk-arc');
    const riskValue = document.getElementById('risk-value');
    const dpCount = document.getElementById('dp-count');
    const phishCount = document.getElementById('phish-count');
    const masterToggle = document.getElementById('master-toggle');
    const statusDot = document.getElementById('system-status-dot');
    const statusText = document.getElementById('system-status-text');

    const arcLength = 125.6;

    function updateUI(stats) {
        if (!stats) return;

        console.log("📊 Sentinel Popup: Updating UI with stats:", stats);

        dpCount.textContent = stats.dpCount || 0;
        phishCount.textContent = stats.phishCount || 0;

        const risk = stats.overallRisk || 0;
        riskValue.textContent = risk.toFixed(1);

        const offset = arcLength - (risk / 10) * arcLength;
        riskArc.style.strokeDashoffset = offset;

        if (risk > 7) {
            riskArc.style.stroke = 'var(--phish-color)';
            riskValue.style.color = 'var(--phish-color)';
        } else if (risk > 3) {
            riskArc.style.stroke = 'var(--dp-color)';
            riskValue.style.color = 'var(--dp-color)';
        } else {
            riskArc.style.stroke = 'var(--accent-neon)';
            riskValue.style.color = '#fff';
        }
    }

    function fetchStats() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) return;
            const activeTabId = tabs[0].id;

            try {
                chrome.runtime.sendMessage(
                    { action: "get_stats", tabId: activeTabId },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            // Gracefully handle "Receiving end does not exist"
                            console.warn("Sentinel Popup:", chrome.runtime.lastError.message);
                            return;
                        }
                        if (response) {
                            updateUI(response);
                        }
                    }
                );
            } catch (err) {
                console.error("Sentinel Popup Error:", err);
            }
        });
    }

    masterToggle.addEventListener('change', (e) => {
        const isActive = e.target.checked;
        
        statusDot.className = isActive ? 'dot active' : 'dot';
        statusText.textContent = isActive ? 'Active' : 'Disabled';
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) return;
            
            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_status", isActive: isActive }, (response) => {
                    // Ignore errors if the content script hasn't loaded on this page (e.g., chrome:// extensions page)
                    if (chrome.runtime.lastError) {
                        console.info("Sentinel: Content script not available on this tab.");
                    }
                });
            } catch (err) {
                console.error("Sentinel Toggle Error:", err);
            }
        });
    });

    // Initial fetch and polling
    fetchStats();
    setInterval(fetchStats, 2000);
});
