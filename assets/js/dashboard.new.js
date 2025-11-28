// =================== ELEMENTS ===================
const locSearch = document.getElementById("locSearch");
const locSearchBtn = document.getElementById("locSearchBtn");
const locResetBtn = document.getElementById("locResetBtn");
const locSuggest = document.getElementById("locSuggest");
const locTitle = document.getElementById("locTitle");
const searchPrompt = document.getElementById("searchPrompt");
const metricsSection = document.getElementById("metricsSection");
const locLoading = document.getElementById("locLoading");

// =================== AUTO SUGGEST ===================
locSearch.addEventListener("input", async () => {
    const q = locSearch.value.trim();
    if (q.length < 2) {
        locSuggest.hidden = true;
        return;
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=8&format=json`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        locSuggest.innerHTML = "";
        locSuggest.hidden = false;

        if (!data.results) return;

        data.results.forEach(city => {
            const li = document.createElement("li");
            li.textContent = `${city.name}, ${city.country}`;
            li.dataset.lat = city.latitude;
            li.dataset.lon = city.longitude;

            li.onclick = () => {
                locSearch.value = li.textContent;
                locSuggest.hidden = true;
                loadCity(city);
            };

            locSuggest.appendChild(li);
        });

    } catch (e) {
        console.log("Suggest Error:", e);
    }
});

// =================== SEARCH BUTTON ===================
locSearchBtn.onclick = async () => {
    const q = locSearch.value.trim();
    if (!q) return;

    locLoading.hidden = false;

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&format=json`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        locLoading.hidden = true;

        if (data.results && data.results.length > 0) {
            loadCity(data.results[0]);
        } else {
            alert("City not found.");
        }

    } catch (e) {
        console.log("Search Error:", e);
        locLoading.hidden = true;
    }
};

// =================== RESET BUTTON ===================
locResetBtn.onclick = () => {
    locSearch.value = "";
    locTitle.textContent = "City Location";
    metricsSection.classList.add("hidden");
    searchPrompt.hidden = false;
    locSuggest.hidden = true;
};

// =================== LOAD CITY ===================
function loadCity(city) {
    locTitle.textContent = `${city.name}, ${city.country}`;
    searchPrompt.hidden = true;
    metricsSection.classList.remove("hidden");

    window.selectedCity = {
        name: city.name,
        lat: city.latitude,
        lon: city.longitude
    };

    // === Demo Data Population ===
    function populateDemoData() {
                // Traffic Status (Speedometer Gauge)
                const gauge = document.getElementById('gauge');
                if (gauge) {
                        const score = Math.floor(65 + Math.random() * 20);
                        const pct = Math.max(0, Math.min(100, score));
                        const angle = (pct / 100) * 180;
                        gauge.innerHTML = `
                                <svg viewBox="0 0 200 120" width="100%" height="80">
                                    <defs>
                                        <linearGradient id="gGrad" x1="0" y1="0" x2="1" y2="1">
                                            <stop offset="0%" stop-color="#4f8cff"/>
                                            <stop offset="100%" stop-color="#7c4dff"/>
                                        </linearGradient>
                                    </defs>
                                    <path d="M10 110 A90 90 0 0 1 190 110" stroke="#222436" stroke-width="18" fill="none" stroke-linecap="round"/>
                                    <path d="M10 110 A90 90 0 0 1 190 110" stroke="url(#gGrad)" stroke-width="12" fill="none" stroke-dasharray="${(Math.PI*90)}" stroke-dashoffset="${(Math.PI*90) - (Math.PI*90)*(pct/100)}" stroke-linecap="round"/>
                                    <line x1="100" y1="110" x2="${100 + 80 * Math.cos(Math.PI - (angle*Math.PI/180))}" y2="${110 - 80 * Math.sin(Math.PI - (angle*Math.PI/180))}" stroke="#e6e7eb" stroke-width="6" stroke-linecap="round"/>
                                    <text x="100" y="60" dominant-baseline="middle" text-anchor="middle" font-size="32" fill="#e6e7eb" font-weight="600">${score}</text>
                                    <text x="100" y="90" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#a6a8b1">Optimization</text>
                                </svg>
                                <div class='muted'>Average optimization level</div>
                                <div class='muted'>Current system status: <span style='color:#31c754;font-weight:600;'>Good</span></div>
                                <div class='muted'>Power Level: <span style='color:#4f8cff;font-weight:600;'>80%</span></div>
                        `;
                }

        // System Health
        document.querySelector('.meter-bar.green').style.width = (85 + Math.random()*10) + '%';
        document.querySelector('.meter-bar.primary').style.width = (65 + Math.random()*20) + '%';
        document.querySelector('.meter-bar.blue').style.width = (80 + Math.random()*10) + '%';
        document.querySelector('#panel-sensors .badge.ok').textContent = 'Active';
        document.querySelector('#panel-sensors .badge.warn').textContent = Math.floor(65 + Math.random()*20) + '%';
        document.querySelector('#panel-sensors .badge.ok:last-child').textContent = 'Good';

        // Traffic Corridors
        const trafficList = document.getElementById('trafficList');
        if (trafficList) {
            trafficList.innerHTML = `
                <li>Airport Express <span class='traffic-badge fast'>FAST</span> <span class='traffic-speed'>${Math.floor(35 + Math.random()*10)} km/h</span></li>
                <li>Ring Road West <span class='traffic-badge moderate'>OK</span> <span class='traffic-speed'>${Math.floor(20 + Math.random()*10)} km/h</span></li>
                <li>Central Business Loop <span class='traffic-badge slow'>SLOW</span> <span class='traffic-speed'>${Math.floor(10 + Math.random()*8)} km/h</span></li>
            `;
        }

        // Active Alerts
        const alertList = document.getElementById('alertList');
        if (alertList) {
            alertList.innerHTML = `
                <li class="status-item"><span>Congestion at Market Junction</span><span class="badge high">HIGH</span></li>
                <li class="status-item"><span>Sensor jitter detected on corridor west</span><span class="badge warn">MED</span></li>
                <li class="status-item"><span>All clear</span><span class="badge ok">LOW</span></li>
            `;
        }

        // Recent Reports
        const reportList = document.getElementById('reportList');
        if (reportList) {
            const now = new Date().toLocaleTimeString();
            reportList.innerHTML = `
                <li>Signal optimization applied • ${now}</li>
                <li>Emergency cleared in ${20 + Math.floor(Math.random()*30)}s • ${now}</li>
                <li>Solar gen ${(2 + Math.random()*3).toFixed(1)}kW • ${now}</li>
            `;
        }

        // Key Metrics
        document.getElementById('kmWait').textContent = (1.8 + Math.random()*1.2).toFixed(1) + 'm';
        document.getElementById('kmEmission').textContent = Math.floor(10 + Math.random()*25) + '%';
        document.getElementById('kmVehicles').textContent = Math.floor(800 + Math.random()*300);

        // Environmental Savings
        document.getElementById('co2Saved').textContent = (8 + Math.random()*8).toFixed(1) + ' kg';
        document.getElementById('fuelSaved').textContent = (2 + Math.random()*4).toFixed(1) + ' L';
        document.getElementById('idleReduced').textContent = (10 + Math.random()*8).toFixed(1) + ' %';

        // Emergency Status Box
        const emergencyList = document.getElementById('emergencyList');
        if (emergencyList) {
            const req = Math.floor(1 + Math.random()*8);
            const avgClear = (15 + Math.random()*30).toFixed(0);
            let reqBadge = 'ok';
            if (req > 6) reqBadge = 'high';
            else if (req > 3) reqBadge = 'warn';
            let clearBadge = 'ok';
            if (avgClear > 35) clearBadge = 'high';
            else if (avgClear > 22) clearBadge = 'warn';
            emergencyList.innerHTML = `
                <li><strong>Priority Requests:</strong> <span class="badge ${reqBadge}">${req}</span></li>
                <li><strong>Avg Clearance:</strong> <span class="badge ${clearBadge}">${avgClear}s</span></li>
            `;
        }

        // Historical Traffic Maps (no-op, just placeholder)
        const histMap = document.getElementById('historical-map');
        if (histMap) {
            histMap.innerHTML = `<div class='muted'>Demo map not available in this mode.</div>`;
        }
    }

    // Initial populate
    populateDemoData();

    // Auto-refresh every 5 seconds (fix: always clear and set interval)
    if (window.demoDataInterval) clearInterval(window.demoDataInterval);
    window.demoDataInterval = setInterval(populateDemoData, 5000);

    console.log("Selected City:", window.selectedCity);
}
