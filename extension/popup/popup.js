document.addEventListener("DOMContentLoaded", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    chrome.runtime.sendMessage(
        {
            action: "get_stats",
            tabId: tab.id
        },
        (stats) => {

            console.log("📊 Popup Stats:", stats);

            // COUNTERS
            document.getElementById("dp-count").textContent =
                stats.dpCount || 0;

            document.getElementById("phish-count").textContent =
                stats.phishCount || 0;

            // RISK METER UPDATE (Added dynamic stroke)
            const riskValueElement = document.getElementById("risk-score");
            const riskArc = document.getElementById("risk-arc");
            const risk = stats.overallRisk || 0;
            riskValueElement.textContent = risk.toFixed(1);
            
            const arcLength = 125.6;
            const offset = arcLength - (risk / 10) * arcLength;
            riskArc.style.strokeDashoffset = offset;

            if (risk > 7) {
                riskArc.style.stroke = 'var(--phish-color)';
                riskValueElement.style.color = 'var(--phish-color)';
            } else if (risk > 3) {
                riskArc.style.stroke = 'var(--dp-color)';
                riskValueElement.style.color = 'var(--dp-color)';
            } else {
                riskArc.style.stroke = 'var(--accent-neon)';
                riskValueElement.style.color = '#fff';
            }

            // RECENT DETECTIONS
            const container =
                document.getElementById("recent-detections");

            container.innerHTML = "";

            const detections =
                stats.recentDetections || [];

            if (detections.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        No suspicious activity detected.
                    </div>
                `;
                return;
            }

            detections.forEach((detection) => {
                const item = document.createElement("div");
                
                const isPhish = detection.category === 'Phishing';
                const themeClass = isPhish ? 'theme-phish' : 'theme-dp';
                const confPercent = Math.round(detection.confidence * 100);

                let severity = 'LOW';
                if (confPercent >= 98) severity = 'CRITICAL';
                else if (confPercent >= 95) severity = 'HIGH';
                else if (confPercent >= 85) severity = 'MEDIUM';

                item.className = `detection-item ${themeClass}`;

                item.innerHTML = `
                    <div class="detection-header">
                        <span class="detection-badge severity-${severity.toLowerCase()}">${severity}</span>
                        <span class="detection-category">⚠️ ${detection.category}</span>
                    </div>

                    <div class="detection-text monospace">
                        "${detection.text}"
                    </div>

                    <div class="detection-progress-container">
                        <div class="detection-progress-bg">
                            <div class="detection-progress-fill" style="width: ${confPercent}%"></div>
                        </div>
                        <span class="detection-confidence">${confPercent}%</span>
                    </div>
                `;

                container.appendChild(item);
            });
        }
    );
});