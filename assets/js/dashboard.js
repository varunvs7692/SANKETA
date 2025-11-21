// Dashboard data population script (no maps)
(function(){
  const CFG = window.SANKETA || {};
  const NO_API = !!CFG.NO_API; // enable pure frontend mode when true
  const CITY_COORDS = (window.SANKETA_CITY_COORDS) || {
    'Pune': [18.5204, 73.8567],
    'Mumbai': [19.0760, 72.8777],
    'Delhi': [28.6139, 77.2090],
    'Bengaluru': [12.9716, 77.5946],
    'Hyderabad': [17.3850, 78.4867],
    'Chennai': [13.0827, 80.2707],
    'Kolkata': [22.5726, 88.3639],
    'Ahmedabad': [23.0225, 72.5714],
    'Jaipur': [26.9124, 75.7873],
    'Surat': [21.1702, 72.8311],
    'Nagpur': [21.1458, 79.0882],
    'Indore': [22.7196, 75.8577],
    'Thane': [19.2183, 72.9781],
    'Bhopal': [23.2599, 77.4126],
    'Visakhapatnam': [17.6868, 83.2185],
    'Patna': [25.5941, 85.1376],
    'Vadodara': [22.3072, 73.1812],
    'Ghaziabad': [28.6692, 77.4538],
    'Ludhiana': [30.9010, 75.8573],
    'Agra': [27.1767, 78.0081]
  };
  const state = {
    history: {
      systemScore: [],
      waitTime: [],
      emissionReduction: [],
      vehiclesProcessed: []
    },
    boundCopy: false,
    currentCity: null,
    es: null,
    loadingEl: null,
    suggestEl: null,
    suggestions: [],
    activeSuggestIndex: -1,
    recent: [],
    // local (no-API) mode
    local: null,
    localTick: null
  };
  const RECENT_KEY = 'sanketa_recent_cities';
  function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }
  function loadRecent(){
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if(Array.isArray(arr)) state.recent = arr.filter(Boolean).slice(0,5);
    } catch(_) { state.recent = []; }
  }
  function saveRecent(){ try { localStorage.setItem(RECENT_KEY, JSON.stringify(state.recent.slice(0,5))); } catch(_){} }
  function addRecent(city){
    const c = (city||'').trim(); if(!c) return;
    state.recent = [c, ...state.recent.filter(x=> x.toLowerCase() !== c.toLowerCase())].slice(0,5);
    saveRecent();
  }
  function clamp(v,min,max){return v<min?min:v>max?max:v;}
  function pushHistory(arr,val,max=40){arr.push(val); if(arr.length>max) arr.shift();}
  function renderGauge(el,value){
    if(!el) return;
    const pct = clamp(Math.round(value),0,100);
    const angle = (pct/100)*180;
    el.innerHTML = `<svg viewBox='0 0 200 120'>
      <defs><linearGradient id='gGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#4f8cff'/><stop offset='100%' stop-color='#7c4dff'/>
      </linearGradient></defs>
      <path d='M10 110 A90 90 0 0 1 190 110' stroke='#222436' stroke-width='18' fill='none' stroke-linecap='round'/>
      <path d='M10 110 A90 90 0 0 1 190 110' stroke='url(#gGrad)' stroke-width='12' fill='none' stroke-dasharray='${(Math.PI*90)}' stroke-dashoffset='${(Math.PI*90) - (Math.PI*90)*(pct/100)}' stroke-linecap='round'/>
      <line x1='100' y1='110' x2='${100 + 80 * Math.cos(Math.PI - (angle*Math.PI/180))}' y2='${110 - 80 * Math.sin(Math.PI - (angle*Math.PI/180))}' stroke='#e6e7eb' stroke-width='6' stroke-linecap='round'/>
      <text x='100' y='60' dominant-baseline='middle' text-anchor='middle' font-size='32' fill='#e6e7eb' font-weight='600'>${pct}</text>
      <text x='100' y='90' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='#a6a8b1'>Flow</text>
    </svg>`;
  }
  function badgeClass(val, warnLow, badLow){
    if(val <= badLow) return 'high';
    if(val <= warnLow) return 'warn';
    return 'ok';
  }
  function renderSparkline(container, data){
    if(!container) return;
    const max = Math.max(...data,1);
    container.innerHTML = data.map((v,i)=>{
      const h = (v/max)*28 + 2;
      const dim = i < data.length - 10 ? ' dim' : '';
      return `<div class='sparkline-bar${dim}' style='height:${h}px'></div>`;
    }).join('');
  }
  function updatePanels(payload){
    setLoading(false);
    const meta = payload.meta || {}; const intersections = payload.intersections || [];
    const score = meta.systemScore ?? (60 + Math.random()*25);
    renderGauge(document.getElementById('gauge'), score);
    pushHistory(state.history.systemScore, score);
    // System Health simulated metrics
    const signalPct = 90 + Math.random()*8;
    const powerPct = (meta.batteryChargePct != null ? Number(meta.batteryChargePct) : (80 + Math.random()*18));
    const respPct = 85 + Math.random()*10;
    document.getElementById('signalBar').style.width = signalPct.toFixed(0)+'%';
    document.getElementById('powerBar').style.width = powerPct.toFixed(0)+'%';
    document.getElementById('respBar').style.width = respPct.toFixed(0)+'%';
    document.getElementById('powerLevelText').textContent = powerPct.toFixed(0)+'%';
    // Key metrics
    const reds = intersections.filter(i=> (i.phase||'').toUpperCase()==='RED').length;
    const ambers = intersections.filter(i=> (i.phase||'').toUpperCase()==='AMBER').length;
    const totalInts = intersections.length || 10;
    const waitMins = Math.max(1.8, 1.6 + reds*0.25 + ambers*0.12 + Math.random()*0.4);
    const emissionPct = Math.max(10, Math.min(35, 22 - (meta.avgGreenUtilizationPct? Number(meta.avgGreenUtilizationPct)-55 : 0) + Math.random()*3));
    const vehiclesNum = Math.round(totalInts * (80 + Math.random()*40));
    const wait = waitMins.toFixed(1)+'m';
    const emission = emissionPct.toFixed(0)+'%';
    const vehicles = String(vehiclesNum);
    document.getElementById('kmWait').textContent = wait;
    document.getElementById('kmEmission').textContent = emission;
    document.getElementById('kmVehicles').textContent = vehicles;
    pushHistory(state.history.waitTime, parseFloat(wait));
    pushHistory(state.history.emissionReduction, parseFloat(emission));
    pushHistory(state.history.vehiclesProcessed, parseInt(vehicles));
    // Reports
    const reportList = document.getElementById('reportList');
    if(reportList){
      const now = new Date().toLocaleTimeString();
      const sample = [
        `Signal optimization applied • ${now}`,
        `Emergency cleared in ${(20+Math.random()*40).toFixed(0)}s • ${now}`,
        `Solar gen ${(2+Math.random()*3).toFixed(1)}kW • ${now}`
      ];
      reportList.innerHTML = sample.map(t=>`<li>${t}</li>`).join('');
    }
    // Environmental
    const co2 = (meta.co2SavedKg != null ? Number(meta.co2SavedKg).toFixed(1) : ((intersections.length*0.8)+Math.random()*10).toFixed(1));
    const fuel = (meta.fuelSavedL != null ? Number(meta.fuelSavedL).toFixed(1) : ((intersections.length*0.3)+Math.random()*5).toFixed(1));
    const idle = (meta.idleReductionPct != null ? Number(meta.idleReductionPct).toFixed(1) : (12 + Math.random()*6).toFixed(1));
    const co2El=document.getElementById('co2Saved'); if(co2El) co2El.textContent=co2+' kg';
    const fuelEl=document.getElementById('fuelSaved'); if(fuelEl) fuelEl.textContent=fuel+' L';
    const idleEl=document.getElementById('idleReduced'); if(idleEl) idleEl.textContent=idle+' %';
    // Energy
    const energyList = document.getElementById('energyList');
    if(energyList){
      const uptime = (meta.uptimePct != null ? meta.uptimePct : (95 + Math.random()*4).toFixed(2));
      const solarOut = (meta.solarOutputKw != null ? meta.solarOutputKw : (8 + Math.random()*2).toFixed(1));
      const battery = (meta.batteryChargePct != null ? meta.batteryChargePct : (70 + Math.random()*25).toFixed(0));
      energyList.innerHTML = `
        <li>Network Uptime <span class='badge ok'>${uptime}%</span></li>
        <li>Solar Output <span class='badge warn'>${solarOut} kW</span></li>
        <li>Battery Reserve <span class='badge ${battery<50?'high':battery<75?'warn':'ok'}'>${battery}%</span></li>`;
    }
    // Emergency
    const emergencyList = document.getElementById('emergencyList');
    if(emergencyList){
      const req = (meta.emergencyRequestsToday != null ? meta.emergencyRequestsToday : Math.round(Math.random()*5));
      const avgClear = (meta.avgClearSeconds != null ? meta.avgClearSeconds : (25 + Math.random()*20).toFixed(0));
      emergencyList.innerHTML = `<li>Priority Requests <span class='badge ${req>6?'high':'ok'}'>${req}</span></li><li>Avg Clearance <span class='badge warn'>${avgClear}s</span></li>`;
    }
    // Efficiency
    const efficiencyList = document.getElementById('efficiencyList');
    if(efficiencyList){
      const greenPct = (meta.avgGreenUtilizationPct != null ? meta.avgGreenUtilizationPct : (55 + Math.random()*25).toFixed(1));
      const optimized = (meta.phasesOptimizedToday != null ? meta.phasesOptimizedToday : (intersections.length*2 + Math.round(Math.random()*10)));
      efficiencyList.innerHTML = `<li>Green Utilization <span class='badge ${greenPct<60?'warn':'ok'}'>${greenPct}%</span></li><li>Phases Optimized <span class='badge ok'>${optimized}</span></li>`;
    }
    // Congestion
    const congestionList = document.getElementById('congestionList');
    if(congestionList){
      const redInts = intersections.filter(i=> (i.phase||'').toUpperCase()==='RED').slice(0,5);
      congestionList.innerHTML = redInts.length ? redInts.map(r=>`<li>${r.name} <span class='badge high'>RED</span></li>`).join('') : '<li>None <span class="badge ok">Clear</span></li>';
    }
    // Traffic Corridors (simulate based on intersections)
    const trafficList = document.getElementById('trafficList');
    if(trafficList){
      const makeSpeed = () => {
        const base = 42 - reds*2 - ambers*1 + Math.random()*6;
        return Math.max(8, Math.min(60, base));
      };
      const items = [
        { name: 'Airport Express', speed: makeSpeed() },
        { name: 'Ring Road West', speed: makeSpeed() },
        { name: 'Central Business Loop', speed: makeSpeed() },
      ];
      trafficList.innerHTML = items.map(it=>{
        const cls = it.speed > 35 ? 'fast' : it.speed > 20 ? 'moderate' : 'slow';
        const label = cls==='fast'?'FAST':cls==='moderate'?'OK':'SLOW';
        return `<li class="traffic-item"><span>${it.name}</span><span><span class="traffic-badge ${cls}">${label}</span> <span class="traffic-speed">${it.speed.toFixed(0)} km/h</span></span></li>`;
      }).join('');
    }
    // Active Alerts (derive from intersections)
    const alertList = document.getElementById('alertList');
    if(alertList){
      const redHot = intersections.filter(i=> (i.phase||'').toUpperCase()==='RED' && (i.remainingSeconds||0) > 20).slice(0,2);
      const msgs = [];
      if(redHot.length){ redHot.forEach(r=> msgs.push({ sev:'HIGH', text:`Congestion at ${r.name}` })); }
      if(intersections.length){ msgs.push({ sev:'MED', text:'Sensor jitter detected on corridor west' }); }
      if(!msgs.length){ msgs.push({ sev:'LOW', text:'All clear' }); }
      alertList.innerHTML = msgs.map(m=>`<li class="status-item"><span>${m.text}</span><span class="badge ${m.sev==='HIGH'?'high':m.sev==='MED'?'warn':'ok'}">${m.sev}</span></li>`).join('');
    }
    // City location summary
    updateLocation(payload);
  }

  function updateLocation(payload){
    const intersections = payload.intersections || [];
    const meta = payload.meta || {};
    const list = document.getElementById('locationList');
    if(!list) return;
    if(!intersections.length){
      list.innerHTML = `<li>No intersection data available</li>`;
      // Clear top bar numbers but keep links usable
      const cEl=document.getElementById('locCenter'); if(cEl) cEl.textContent='--, --';
      const cntEl=document.getElementById('locCounts'); if(cntEl) cntEl.textContent='0 green / 0 amber / 0 red';
      const tEl=document.getElementById('locTitle'); if(tEl) tEl.textContent= meta.cityName || state.currentCity || 'City Location';
      const aEl=document.getElementById('locOpen');
      if(aEl){
        const name = meta.cityName || state.currentCity;
        if(name){
          aEl.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
        } else {
          aEl.href = 'https://www.google.com/maps';
        }
        aEl.removeAttribute('aria-disabled');
      }
      const oEl=document.getElementById('locOpenOSM');
      if(oEl){
        const name = meta.cityName || state.currentCity;
        if(name){
          oEl.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}`;
        } else {
          oEl.href = 'https://www.openstreetmap.org/';
        }
        oEl.removeAttribute('aria-disabled');
      }
      return;
    }
    // compute centroid and bounds
    let sumLat=0,sumLng=0,minLat=Infinity,minLng=Infinity,maxLat=-Infinity,maxLng=-Infinity;
    const phaseCounts = {GREEN:0,AMBER:0,RED:0,UNKNOWN:0};
    intersections.forEach(i=>{
      const lat = parseFloat(i.lat)||0; const lng = parseFloat(i.lng)||0;
      sumLat += lat; sumLng += lng;
      minLat = Math.min(minLat, lat); minLng = Math.min(minLng, lng);
      maxLat = Math.max(maxLat, lat); maxLng = Math.max(maxLng, lng);
      const p = (i.phase||'UNKNOWN').toUpperCase(); phaseCounts[p] = (phaseCounts[p]||0)+1;
    });
    const centerLat = (sumLat / intersections.length).toFixed(6);
    const centerLng = (sumLng / intersections.length).toFixed(6);
    // busiest intersection: prefer RED with largest remainingSeconds, else highest remainingSeconds
    const reds = intersections.filter(i=>i.phase==='RED');
    let busiest = null;
    if(reds.length){ busiest = reds.reduce((a,b)=> ( (a.remainingSeconds||0) > (b.remainingSeconds||0) ? a : b )); }
    else busiest = intersections.reduce((a,b)=> ( (a.remainingSeconds||0) > (b.remainingSeconds||0) ? a : b ));
    const busiestName = busiest?.name || 'N/A';
    const busiestPhase = busiest?.phase || 'N/A';
    const busiestSecs = busiest?.remainingSeconds ?? '--';

    list.innerHTML = `
      <li>Intersections <span class='badge ok'>${intersections.length}</span></li>
      <li>Center <span>${centerLat}, ${centerLng}</span></li>
      <li>Bounds <span>${minLat.toFixed(6)},${minLng.toFixed(6)} → ${maxLat.toFixed(6)},${maxLng.toFixed(6)}</span></li>
      <li>Green / Amber / Red <span class='badge ok'>${phaseCounts.GREEN||0}</span> <span class='badge warn'>${phaseCounts.AMBER||0}</span> <span class='badge high'>${phaseCounts.RED||0}</span></li>
      <li>Busiest Intersection <span>${busiestName} (${busiestPhase} • ${busiestSecs}s)</span></li>
    `;

    // Update top location bar
    const titleEl=document.getElementById('locTitle'); if(titleEl) titleEl.textContent = meta.cityName || state.currentCity || 'City Location';
    const centerEl=document.getElementById('locCenter'); if(centerEl) {
      centerEl.textContent = `${centerLat}, ${centerLng}`;
      if(!state.boundCopy){
        centerEl.setAttribute('title','Click to copy coordinates');
        centerEl.setAttribute('aria-label','Coordinates: click to copy');
        centerEl.style.cursor = 'pointer';
        centerEl.addEventListener('click', ()=>{
          const txt = centerEl.textContent.trim();
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(txt).then(()=>{
              const old = centerEl.textContent;
              centerEl.textContent = old + ' ✓';
              setTimeout(()=>{ centerEl.textContent = old; }, 900);
            }).catch(()=>{/* ignore */});
          }
        });
        state.boundCopy = true;
      }
    }
    const countsEl=document.getElementById('locCounts'); if(countsEl) countsEl.textContent = `${phaseCounts.GREEN||0} green / ${phaseCounts.AMBER||0} amber / ${phaseCounts.RED||0} red`;
    const openEl=document.getElementById('locOpen'); if(openEl) {
      openEl.href = `https://www.google.com/maps?q=${centerLat},${centerLng}`;
      openEl.removeAttribute('aria-disabled');
    }
    const osmEl=document.getElementById('locOpenOSM'); if(osmEl){
      osmEl.href = `https://www.openstreetmap.org/?mlat=${centerLat}&mlon=${centerLng}#map=14/${centerLat}/${centerLng}`;
      osmEl.removeAttribute('aria-disabled');
    }
  }
  function setLoading(isLoading){
    if(!state.loadingEl){ state.loadingEl = document.getElementById('locLoading'); }
    if(!state.loadingEl) return;
    if(isLoading){
      state.loadingEl.hidden = false;
      state.loadingEl.setAttribute('aria-hidden','false');
    } else {
      state.loadingEl.hidden = true;
      state.loadingEl.setAttribute('aria-hidden','true');
    }
  }
  async function poll(){
    if(NO_API){
      if(!state.currentCity){
        // No city selected: keep panels empty and visible prompt
        updatePanels({ meta:{}, intersections:[] });
        return;
      }
      if(!state.local){ initLocal(state.currentCity); }
      updatePanels(state.local);
      return;
    }
    try {
      const url = 'http://localhost:4000/api/intersections' + (state.currentCity ? `?city=${encodeURIComponent(state.currentCity)}` : '');
      setLoading(true);
      const r = await fetch(url);
      const j = await r.json();
      if(j.ok){ updatePanels(j); }
      else { updatePanels({intersections:[], meta:{}}); }
    } catch(e){ updatePanels({intersections:[], meta:{}}); }
  }
  function startSSE(){
    if(NO_API){
      // run a local ticking interval to animate remainingSeconds and rotate phases
      if(state.es){ try { state.es.close(); } catch(_){} state.es=null; }
      if(state.localTick) { clearInterval(state.localTick); state.localTick=null; }
      if(!state.currentCity){ return; }
      state.localTick = setInterval(()=>{
        if(!state.local) return;
        state.local.intersections.forEach(int => {
          int.remainingSeconds -= 1;
          if (int.remainingSeconds <= 0) {
            if (int.phase === 'GREEN') { int.phase = 'AMBER'; int.remainingSeconds = 5; }
            else if (int.phase === 'AMBER') { int.phase = 'RED'; int.remainingSeconds = 30; }
            else if (int.phase === 'RED') { int.phase = 'GREEN'; int.remainingSeconds = 25; }
          }
        });
        updatePanels(state.local);
      }, 1000);
      return;
    }
    try {
      if(state.es){ try { state.es.close(); } catch(_){} }
      const url = 'http://localhost:4000/api/stream' + (state.currentCity ? `?city=${encodeURIComponent(state.currentCity)}` : '');
      const es = new EventSource(url);
      state.es = es;
      es.addEventListener('update', ev => {
        try { const payload = JSON.parse(ev.data); updatePanels(payload); } catch(err){ /* ignore */ }
      });
      es.onerror = () => { es.close(); };
    } catch(e){ /* ignore */ }
  }
  // --- Local mode helpers ---
  function seededRand(seed){
    // Mulberry32
    let t = seed + 0x6D2B79F5;
    return function(){
      t |= 0; t = t + 0x6D2B79F5 | 0;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashString(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0); }
  function pickCenterForCity(city){
    if(city && CITY_COORDS[city]) return CITY_COORDS[city];
    // Try loose match by token
    if(city){
      const key = Object.keys(CITY_COORDS).find(k=> city.toLowerCase().includes(k.toLowerCase()));
      if(key) return CITY_COORDS[key];
      // Deterministic pseudo-center within India bbox if unknown
      const h = hashString(city);
      const rn = () => { const x = (h ^ 0x9e3779b9) >>> 0; return (x % 10000) / 10000; };
      const lat = 8 + rn() * (37 - 8);   // 8N .. 37N
      const lng = 68 + rn() * (97 - 68); // 68E .. 97E
      return [+(lat.toFixed(4)), +(lng.toFixed(4))];
    }
    return CITY_COORDS['Bengaluru'];
  }
  function genLocal(city){
    const [clat, clng] = pickCenterForCity(city);
    const seed = hashString((city||'default') + '|sanketa');
    const rand = seededRand(seed);
    const count = 12;
    const phases = ['GREEN','AMBER','RED'];
    const names = ['Central','Market','Station','College','Airport','Park','River','Hill','Temple','Mall'];
    const ints = [];
    for(let i=0;i<count;i++){
      const dlat = (rand()-0.5)*0.08;
      const dlng = (rand()-0.5)*0.08;
      const phase = phases[Math.floor(rand()*phases.length)];
      const rem = phase==='RED'? (20+Math.floor(rand()*25)) : phase==='AMBER'? (4+Math.floor(rand()*3)) : (15+Math.floor(rand()*20));
      ints.push({ id: `LINT${String(i+1).padStart(3,'0')}`, name: `${names[i%names.length]} Junction ${i+1}`, lat: +(clat+dlat).toFixed(6), lng: +(clng+dlng).toFixed(6), phase, remainingSeconds: rem });
    }
    // Meta derived from seeded ranges
    const meta = {
      cityName: city || 'City',
      centerLat: clat,
      centerLng: clng,
      uptimePct: (96 + rand()*3).toFixed(2),
      solarOutputKw: (8 + rand()*2).toFixed(1),
      batteryChargePct: (70 + rand()*25).toFixed(0),
      co2SavedKg: (8 + rand()*4).toFixed(1),
      fuelSavedL: (2 + rand()*3).toFixed(1),
      idleReductionPct: (10 + rand()*6).toFixed(1),
      emergencyRequestsToday: Math.round(rand()*5),
      avgClearSeconds: (22 + rand()*18).toFixed(0),
      avgGreenUtilizationPct: (55 + rand()*25).toFixed(1),
      phasesOptimizedToday: 4 + Math.round(rand()*8)
    };
    return { meta, intersections: ints };
  }
  function initLocal(city){
    state.local = genLocal(city || state.currentCity || 'Bengaluru');
  }
  function setCity(name){
    const city = (name||'').trim();
    if(!city) return;
    state.currentCity = city;
    addRecent(city);
    const tEl=document.getElementById('locTitle'); if(tEl) tEl.textContent = city;
    const cntEl=document.getElementById('locCounts'); if(cntEl) cntEl.textContent = '0 green / 0 amber / 0 red';
    const cEl=document.getElementById('locCenter'); if(cEl) cEl.textContent='--, --';
    const aEl=document.getElementById('locOpen'); if(aEl){ aEl.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city)}`; aEl.removeAttribute('aria-disabled'); }
    const oEl=document.getElementById('locOpenOSM'); if(oEl){ oEl.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(city)}`; oEl.removeAttribute('aria-disabled'); }
    // Show metrics, reconnect SSE and poll now
    setLoading(true);
    toggleMetrics(true);
    if(NO_API){ initLocal(city); updatePanels(state.local); }
    startSSE();
    poll();
  }
  function resetCity(){
    state.currentCity = null;
    const tEl=document.getElementById('locTitle'); if(tEl) tEl.textContent = 'City Location';
    const cntEl=document.getElementById('locCounts'); if(cntEl) cntEl.textContent = '0 green / 0 amber / 0 red';
    const cEl=document.getElementById('locCenter'); if(cEl) cEl.textContent='--, --';
    const aEl=document.getElementById('locOpen'); if(aEl){ aEl.href = 'https://www.google.com/maps'; aEl.removeAttribute('aria-disabled'); }
    const oEl=document.getElementById('locOpenOSM'); if(oEl){ oEl.href = 'https://www.openstreetmap.org/'; oEl.removeAttribute('aria-disabled'); }
    const si=document.getElementById('locSearch'); if(si) si.value = '';
    setLoading(true);
    toggleMetrics(false);
    if(NO_API){ state.local = null; if(state.localTick){ clearInterval(state.localTick); state.localTick=null; } updatePanels({ meta:{}, intersections:[] }); }
    startSSE();
    poll();
  }
  function toggleMetrics(show){
    const m = document.getElementById('metricsSection');
    const p = document.getElementById('searchPrompt');
    if(m) m.classList.toggle('hidden', !show);
    if(p) p.classList.toggle('hidden', show);
  }
  function hideSuggestions(){ if(!state.suggestEl){ state.suggestEl = document.getElementById('locSuggest'); } if(state.suggestEl){ state.suggestEl.hidden = true; state.suggestEl.innerHTML=''; } state.suggestions=[]; state.activeSuggestIndex=-1; }
  function renderSuggestions(list){
    if(!state.suggestEl){ state.suggestEl = document.getElementById('locSuggest'); }
    if(!state.suggestEl) return;
    if(!list || !list.length){ hideSuggestions(); return; }
    state.suggestions = list;
    state.activeSuggestIndex = -1;
    state.suggestEl.innerHTML = list.map((c,i)=>`<li role="option" data-index="${i}">${c}</li>`).join('');
    state.suggestEl.hidden = false;
    Array.from(state.suggestEl.querySelectorAll('li')).forEach(li=>{
      li.addEventListener('mousedown', (e)=>{ // mousedown to fire before input blur
        e.preventDefault();
        const idx = parseInt(li.getAttribute('data-index'))||0; const city = state.suggestions[idx];
        const si = document.getElementById('locSearch'); if(si){ si.value = city; }
        hideSuggestions();
        setCity(city);
      });
    });
  }
  async function fetchSuggestions(q){
    const query = (q||'').trim();
    if(query.length < 2){
      if(state.recent && state.recent.length){ renderSuggestions(state.recent); }
      else { hideSuggestions(); }
      return;
    }
    // Try backend first
    try {
      const r = await fetch(`http://localhost:4000/api/cities?query=${encodeURIComponent(query)}`);
      if(r.ok){ const j = await r.json(); if(Array.isArray(j) && j.length){ renderSuggestions(j.slice(0,10)); return; } }
    } catch(_) { /* ignore and fallback */ }
    // Fallback static list (extend as needed or provide via window.SANKETA_CITY_LIST)
    const fallback = (window.SANKETA_CITY_LIST && Array.isArray(window.SANKETA_CITY_LIST)) ? window.SANKETA_CITY_LIST : [
      'Pune','Mumbai','Delhi','Bengaluru','Hyderabad','Chennai','Kolkata','Ahmedabad','Jaipur','Surat',
      'Nagpur','Indore','Thane','Bhopal','Visakhapatnam','Patna','Vadodara','Ghaziabad','Ludhiana','Agra'
    ];
    const lower = query.toLowerCase();
    const filtered = fallback.filter(c=> c.toLowerCase().includes(lower)).slice(0,10);
    renderSuggestions(filtered);
  }
  const debouncedSuggest = debounce(fetchSuggestions, 200);
  function handleSuggestKey(e){
    if(!state.suggestEl || state.suggestEl.hidden) return;
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      state.activeSuggestIndex = (state.activeSuggestIndex + 1) % state.suggestions.length;
    } else if(e.key === 'ArrowUp'){
      e.preventDefault();
      state.activeSuggestIndex = (state.activeSuggestIndex - 1 + state.suggestions.length) % state.suggestions.length;
    } else if(e.key === 'Enter'){
      if(state.activeSuggestIndex >= 0){
        e.preventDefault();
        const city = state.suggestions[state.activeSuggestIndex];
        const si = document.getElementById('locSearch'); if(si){ si.value = city; }
        hideSuggestions();
        setCity(city);
        return;
      }
    } else if(e.key === 'Escape'){
      hideSuggestions();
      return;
    } else {
      return; // other keys not handled here
    }
    // update active class
    Array.from(state.suggestEl.querySelectorAll('li')).forEach((li,i)=>{
      if(i === state.activeSuggestIndex) li.classList.add('active'); else li.classList.remove('active');
    });
  }
  // Bind search controls
  const sb = document.getElementById('locSearchBtn');
  const si = document.getElementById('locSearch');
  const sr = document.getElementById('locResetBtn');
  if(sb && si){
    sb.addEventListener('click', ()=> setCity(si.value));
    si.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); setCity(si.value); } else { handleSuggestKey(e); } });
    si.addEventListener('input', ()=> debouncedSuggest(si.value));
    si.addEventListener('focus', ()=>{ const v=(si.value||'').trim(); if(v.length<2){ if(state.recent && state.recent.length){ renderSuggestions(state.recent); } } });
    si.addEventListener('blur', ()=> setTimeout(hideSuggestions, 120));
  }
  if(sr){ sr.addEventListener('click', resetCity); }

  // Historical Maps
  let historicalMap = null;
  let historicalMarkers = new Map();
  function initHistoricalMap(){
    const el = document.getElementById('historical-map');
    if(!el || historicalMap) return;
    if(typeof window.L === 'undefined'){ el.innerHTML = '<div class="map-error">Map library failed to load.</div>'; return; }
    historicalMap = L.map('historical-map').setView([12.9716,77.5946],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(historicalMap);
  }
  function updateHistoricalMap(monthOffset){
    if(!historicalMap || !state.currentCity) return;
    historicalMarkers.forEach(m => historicalMap.removeLayer(m));
    historicalMarkers.clear();
    const data = genHistoricalData(state.currentCity, monthOffset);
    data.forEach(int=>{
      const color = int.phase==='GREEN'?'#31c754':int.phase==='AMBER'?'#ffb347':'#ff4d4d';
      const m = L.circleMarker([int.lat,int.lng],{radius:7,color,fillColor:color,fillOpacity:.85,weight:2}).addTo(historicalMap);
      m.bindPopup(`${int.name}<br/>${int.phase} • ${int.remainingSeconds}s`);
      historicalMarkers.set(int.id, m);
    });
  }
  function genHistoricalData(city, monthOffset){
    const [clat, clng] = pickCenterForCity(city);
    const seed = hashString((city||'default') + '|historical|' + monthOffset);
    const rand = seededRand(seed);
    const count = 12;
    const phases = ['GREEN','AMBER','RED'];
    const names = ['Central','Market','Station','College','Airport','Park','River','Hill','Temple','Mall'];
    const ints = [];
    for(let i=0;i<count;i++){
      const dlat = (rand()-0.5)*0.08;
      const dlng = (rand()-0.5)*0.08;
      const phase = phases[Math.floor(rand()*phases.length)];
      const rem = phase==='RED'? (20+Math.floor(rand()*25)) : phase==='AMBER'? (4+Math.floor(rand()*3)) : (15+Math.floor(rand()*20));
      ints.push({ id: `HINT${String(i+1).padStart(3,'0')}`, name: `${names[i%names.length]} Junction ${i+1}`, lat: +(clat+dlat).toFixed(6), lng: +(clng+dlng).toFixed(6), phase, remainingSeconds: rem });
    }
    return ints;
  }
  // Bind historical buttons
  document.getElementById('month-1').addEventListener('click', () => updateHistoricalMap(1));
  document.getElementById('month-2').addEventListener('click', () => updateHistoricalMap(2));
  document.getElementById('month-3').addEventListener('click', () => updateHistoricalMap(3));

  // Kickoff
  loadRecent();
  toggleMetrics(false);
  initHistoricalMap();
  if(NO_API){ /* hold until city selected */ }
  poll();
  setInterval(poll, 5000);
  startSSE();
})();