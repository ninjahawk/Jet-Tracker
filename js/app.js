/* ============================================================
   JETTRACK — app logic
   Live mode: polls the adsb.lol public API for N628TS.
   Mock mode: when the target is LADD/PIA-filtered (usual case),
   runs a clearly-labeled simulated leg so the UI stays alive.
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 30000;
  const SIM_TICK_MS = 1000;
  const API_URL = `https://api.adsb.lol/v2/hex/${TARGET.icao}`;

  const $ = (id) => document.getElementById(id);

  const state = {
    mode: "CONNECTING", // CONNECTING | LIVE | MOCK
    lat: null, lon: null,
    altFt: null, gsKt: null, hdg: null, squawk: null,
    trail: [],
    simT: Math.floor(Math.random() * MOCK_ROUTE.durationSec),
    alertFired: false,
  };

  /* ---------------- clock ---------------- */
  function zulu(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
  }
  function zuluStamp(d = new Date()) {
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
  }
  setInterval(() => { $("zulu-clock").textContent = zulu(); }, 1000);
  $("zulu-clock").textContent = zulu();

  /* ---------------- tabs ---------------- */
  const panes = { investigations: $("pane-investigations"), watchlist: $("pane-watchlist"), about: $("pane-about") };
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      Object.entries(panes).forEach(([k, el]) => el.classList.toggle("hidden", k !== btn.dataset.tab));
    });
  });

  /* ---------------- watchlist table ---------------- */
  (function renderWatchlist() {
    const tbody = document.querySelector("#watchlist-table tbody");
    tbody.innerHTML = G700_WATCHLIST.map((r) => {
      const [reg, notes, modeS, serial, op, built, aw, flagged] = r;
      const flag = flagged
        ? '<span class="chip chip-amber">FALCON HOLDINGS</span>'
        : (notes ? `<span class="chip chip-dim">${notes.toUpperCase().slice(0, 14)}</span>` : "");
      return `<tr class="${flagged ? "flagged" : ""}">
        <td>${reg}</td><td>${modeS}</td><td>${serial}</td>
        <td>${op || "—"}</td><td>${built}</td><td>${aw || "—"}</td><td>${flag}</td>
      </tr>`;
    }).join("");
    $("watchlist-count").textContent = `${G700_WATCHLIST.length} AIRFRAMES · 2 FLAGGED`;
  })();

  /* ---------------- map ---------------- */
  const map = L.map("map", { zoomControl: true, attributionControl: true })
    .setView([28.6, -97.4], 6);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · parody UI, not Palantir',
    subdomains: "abcd",
    maxZoom: 12,
  }).addTo(map);

  // faint graticule
  const graticule = L.layerGroup().addTo(map);
  for (let lat = 0; lat <= 70; lat += 5) {
    graticule.addLayer(L.polyline([[lat, -180], [lat, 0]], { color: "#2f3f4a", weight: 0.5, opacity: 0.4, interactive: false }));
  }
  for (let lon = -180; lon <= 0; lon += 5) {
    graticule.addLayer(L.polyline([[0, lon], [70, lon]], { color: "#2f3f4a", weight: 0.5, opacity: 0.4, interactive: false }));
  }

  // POIs
  POIS.forEach((p) => {
    L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: "", html: '<div class="poi-diamond"></div>', iconSize: [10, 10], iconAnchor: [5, 5] }),
      interactive: false,
    }).addTo(map);
    L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: "poi-label", html: p.name, iconSize: [120, 12], iconAnchor: [-8, -2] }),
      interactive: false,
    }).addTo(map);
  });

  // target jet marker
  const jetSvg = (hdg) =>
    `<svg width="30" height="30" viewBox="0 0 30 30" style="transform: rotate(${hdg}deg)">
       <path d="M15 3 L18 12 L27 16 L18 17.5 L17 25 L19.5 27.5 L15 26 L10.5 27.5 L13 25 L12 17.5 L3 16 L12 12 Z"
             fill="#e8c547" stroke="#10161a" stroke-width="1"/>
     </svg>`;
  const jetMarker = L.marker([28.6, -97.4], {
    icon: L.divIcon({ className: "jet-icon", html: jetSvg(0), iconSize: [30, 30], iconAnchor: [15, 15] }),
    interactive: false,
  });

  const trailLine = L.polyline([], { color: "#3fc1d3", weight: 2, opacity: 0.85, dashArray: "1 6" });
  const rings = L.layerGroup();
  const ringRadiiKm = [50, 100, 150, 200];

  function drawRings(lat, lon) {
    rings.clearLayers();
    ringRadiiKm.forEach((km) => {
      rings.addLayer(L.circle([lat, lon], {
        radius: km * 1000,
        color: "#e8c547", weight: 1, opacity: 0.35, fill: false, interactive: false,
      }));
      const labelLat = lat + km / 111; // due-north label offset
      rings.addLayer(L.marker([labelLat, lon], {
        icon: L.divIcon({ className: "ring-label", html: `${km} KM`, iconSize: [40, 10], iconAnchor: [20, 5] }),
        interactive: false,
      }));
    });
  }

  /* ---------------- feed ---------------- */
  const feed = $("feed");

  function addMsg(who, html) {
    const div = document.createElement("div");
    div.className = `msg msg-${who}`;
    const label = who === "ai" ? "AIP ASSISTANT" : "YOU";
    const av = who === "ai" ? "AI" : "U";
    div.innerHTML = `
      <div class="msg-meta"><span class="msg-avatar">${av}</span>${label} · ${zulu()}</div>
      <div class="msg-body">${html}</div>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  function addAlertCard(title, summary, details) {
    const div = document.createElement("div");
    div.className = "msg msg-ai";
    const rows = details.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
    div.innerHTML = `
      <div class="msg-meta"><span class="msg-avatar">AI</span>AIP ASSISTANT · ${zulu()}</div>
      <div class="alert-card">
        <div class="alert-card-head">
          <span class="alert-title">${title}</span>
          <span class="chip chip-red">ALERT</span>
        </div>
        <div class="alert-body">
          <div class="alert-summary">${summary}</div>
          <table class="kv">${rows}</table>
        </div>
      </div>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  /* ---------------- event log ---------------- */
  const eventlog = $("eventlog");
  function logEvent(text, cls = "") {
    const div = document.createElement("div");
    div.innerHTML = `<span class="ts">${zulu()}</span><span class="${cls}">${text}</span>`;
    eventlog.appendChild(div);
    while (eventlog.children.length > 40) eventlog.removeChild(eventlog.firstChild);
  }

  /* ---------------- badge / stats ---------------- */
  function setBadge(mode) {
    const badge = $("data-badge");
    const text = $("data-badge-text");
    badge.classList.remove("badge-live", "badge-mock");
    if (mode === "LIVE") {
      badge.classList.add("badge-live");
      text.textContent = "LIVE ADS-B";
      $("eventlog-mode").textContent = "SOURCE: adsb.lol";
      $("feed-status").textContent = "FEED ACTIVE · LIVE";
    } else if (mode === "MOCK") {
      badge.classList.add("badge-mock");
      text.textContent = "MOCK DATA";
      $("eventlog-mode").textContent = "SIMULATED TRACK — TARGET FILTERED";
      $("feed-status").textContent = "FEED ACTIVE · SIM";
    } else {
      badge.classList.add("badge-mock");
      text.textContent = "CONNECTING…";
    }
  }

  function fmtPos(lat, lon) {
    return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
  }

  function renderStats() {
    $("stat-alt").textContent = state.altFt != null ? `${Math.round(state.altFt).toLocaleString()} ft` : "—";
    $("stat-gs").textContent = state.gsKt != null ? `${Math.round(state.gsKt)} kt` : "—";
    $("stat-hdg").textContent = state.hdg != null ? `${Math.round(state.hdg)}°` : "—";
    $("stat-squawk").textContent = state.squawk || "—";
    $("stat-pos").textContent = state.lat != null ? fmtPos(state.lat, state.lon) : "—";
    $("stat-src").textContent = state.mode === "LIVE" ? "ADS-B" : state.mode === "MOCK" ? "SIM" : "—";
    $("dossier-updated").textContent = `UPD ${zulu()}`;
  }

  function updateTrack(lat, lon, follow = false) {
    state.lat = lat; state.lon = lon;
    if (!map.hasLayer(jetMarker)) { jetMarker.addTo(map); trailLine.addTo(map); rings.addTo(map); }
    jetMarker.setLatLng([lat, lon]);
    jetMarker.setIcon(L.divIcon({ className: "jet-icon", html: jetSvg(state.hdg || 0), iconSize: [30, 30], iconAnchor: [15, 15] }));
    state.trail.push([lat, lon]);
    if (state.trail.length > 400) state.trail.shift();
    trailLine.setLatLngs(state.trail);
    drawRings(lat, lon);
    if (follow) map.panTo([lat, lon], { animate: true });
    renderStats();
  }

  /* ---------------- mock simulation ---------------- */
  function simStep() {
    const R = MOCK_ROUTE;
    state.simT = (state.simT + SIM_TICK_MS / 1000) % R.durationSec;
    const f = state.simT / R.durationSec;

    const lat = R.from.lat + (R.to.lat - R.from.lat) * f;
    const lon = R.from.lon + (R.to.lon - R.from.lon) * f;

    // simple climb / cruise / descent profile
    const climb = Math.min(f / 0.18, 1);
    const descent = Math.min((1 - f) / 0.18, 1);
    const prof = Math.min(climb, descent);
    state.altFt = 500 + (R.cruiseAltFt - 500) * prof;
    state.gsKt = 160 + (R.cruiseGsKt - 160) * prof + Math.sin(state.simT / 7) * 6;

    const dLat = R.to.lat - R.from.lat;
    const dLon = (R.to.lon - R.from.lon) * Math.cos((lat * Math.PI) / 180);
    state.hdg = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
    state.squawk = "1200";

    // restart the leg cleanly when it loops
    if (state.simT < SIM_TICK_MS / 1000) {
      state.trail = [];
      logEvent(`SIM // leg restarted ${R.from.name} → ${R.to.name}`);
    }
    updateTrack(lat, lon);
  }

  let simTimer = null;
  function enterMode(mode) {
    if (state.mode === mode) return;
    const prev = state.mode;
    state.mode = mode;
    setBadge(mode);

    if (mode === "MOCK") {
      if (prev === "LIVE") state.trail = [];
      if (!simTimer) simTimer = setInterval(simStep, SIM_TICK_MS);
      logEvent("Target not broadcasting — LADD/PIA filtered. Simulated track engaged.", "ev-alert");
      if (!state.alertFired) fireBootAlert("SIM");
    } else if (mode === "LIVE") {
      if (simTimer) { clearInterval(simTimer); simTimer = null; }
      state.trail = [];
      logEvent("Live ADS-B contact acquired.", "ev-good");
      if (!state.alertFired) fireBootAlert("ADS-B");
    }
  }

  function fireBootAlert(src) {
    state.alertFired = true;
    addAlertCard(
      "Alert — Anomalous billionaire jet activity detected",
      "An algorithm that detects suspiciously large carbon footprints has identified 1 aircraft of interest in the area of operations.",
      [
        ["Timestamp", zuluStamp()],
        ["Registration", `${TARGET.reg} (${TARGET.type})`],
        ["ICAO / Mode S", TARGET.icao.toUpperCase()],
        ["Feed Type", src],
        ["Position Quality", src === "SIM" ? "SIMULATED" : "MLAT/ADS-B"],
        ["Algorithm", "Billionaire Jet Detector v4.2.0"],
      ]
    );
    addMsg("ai", 'Ask me something — try <span class="mono hl">where is the jet</span>, <span class="mono hl">g700</span>, <span class="mono hl">who runs this</span>, or <span class="mono hl">help</span>.');
  }

  /* ---------------- live polling ---------------- */
  async function pollLive() {
    try {
      const res = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const ac = json && json.ac && json.ac[0];
      if (ac && ac.lat != null && ac.lon != null) {
        state.altFt = typeof ac.alt_baro === "number" ? ac.alt_baro : (ac.alt_geom ?? null);
        state.gsKt = ac.gs ?? null;
        state.hdg = ac.track ?? ac.true_heading ?? null;
        state.squawk = ac.squawk || null;
        enterMode("LIVE");
        updateTrack(ac.lat, ac.lon, true);
        logEvent(`LIVE // ${TARGET.reg} ${fmtPos(ac.lat, ac.lon)} ${state.altFt ? Math.round(state.altFt) + "ft" : ""}`, "ev-good");
        return;
      }
      enterMode("MOCK");
    } catch {
      enterMode("MOCK");
    }
  }

  /* ---------------- ask box (canned AIP responses) ---------------- */
  const RESPONSES = [
    [/where|position|location|jet now/i, () =>
      state.lat != null
        ? `Current plotted position of <span class="mono hl">${TARGET.reg}</span>: <span class="mono">${fmtPos(state.lat, state.lon)}</span> at <span class="mono">${Math.round(state.altFt || 0).toLocaleString()} ft</span>, ${Math.round(state.gsKt || 0)} kt over the ground. ${state.mode === "MOCK" ? "Note: the live transponder is LADD/PIA-filtered, so this track is <strong>simulated</strong> for demonstration." : "This is a live ADS-B/MLAT position."}`
        : "No position resolved yet — the feed is still connecting."],
    [/g700|watchlist|falcon/i, () =>
      'Registry sweep of early Gulfstream G700 airframes flagged <strong>2 of 23</strong> tied to <strong>Falcon Holdings LLC</strong> (Sheridan, WY & Lugano, CH — founded 2021): <span class="mono hl">N711GA</span> and <span class="mono hl">N112GA</span>. Open the <strong>G700 Watchlist</strong> tab for the full table and sourcing.'],
    [/who|mods|runs this|about/i, () =>
      'This terminal is maintained by the mods of <a href="https://www.reddit.com/r/elonjettracker/" target="_blank" rel="noopener">r/ElonJetTracker</a> using public ADS-B data. See the <strong>Sub Info</strong> tab for sources and credits. (And no — we are not Palantir. This is a parody.)'],
    [/adsb|ads-b|ladd|pia|blocked|faa/i, () =>
      'ADS-B is a public broadcast — any aircraft flying in most controlled airspace transmits its position. Owners can request FAA LADD filtering or fly under a Privacy ICAO Address (PIA), which is why community networks like ADS-B Exchange matter. See the <a href="https://www.faa.gov/air_traffic/technology/equipadsb/resources/faq" target="_blank" rel="noopener">FAA ADS-B FAQ</a>.'],
    [/emission|carbon|fuel/i, () =>
      'A G650ER burns roughly 500 gallons of jet fuel per hour at cruise. The algorithm rates this carbon footprint: <span class="chip chip-red">CRITICAL</span>'],
    [/help/i, () =>
      'Try: <span class="mono hl">where is the jet</span> · <span class="mono hl">g700 watchlist</span> · <span class="mono hl">what is ads-b</span> · <span class="mono hl">carbon</span> · <span class="mono hl">who runs this</span>'],
  ];

  $("ask-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("ask-input");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    addMsg("user", q.replace(/</g, "&lt;"));
    const match = RESPONSES.find(([re]) => re.test(q));
    setTimeout(() => {
      addMsg("ai", match
        ? match[1]()
        : 'Query not recognized by this demo terminal. Type <span class="mono hl">help</span> for supported prompts, or take it to the sub — a human analyst (redditor) will oblige.');
    }, 450);
  });

  /* ---------------- collapsible overlays ---------------- */
  function wireCollapse(btnId, targetSel, collapsedDefault) {
    const btn = $(btnId);
    const target = document.querySelector(targetSel);
    const set = (collapsed) => {
      target.classList.toggle("collapsed", collapsed);
      btn.textContent = collapsed ? "+" : "−";
      btn.setAttribute("aria-expanded", String(!collapsed));
    };
    btn.addEventListener("click", () => set(!target.classList.contains("collapsed")));
    set(collapsedDefault);
  }
  const isSmallScreen = window.matchMedia("(max-width: 980px)").matches;
  wireCollapse("dossier-toggle", ".map-overlay-tr .overlay-card", isSmallScreen);
  wireCollapse("eventlog-toggle", ".eventlog", isSmallScreen);

  /* ---------------- boot ---------------- */
  setBadge("CONNECTING");
  addMsg("ai", `Terminal initialized · ${zuluStamp()}. Standing watch on <span class="mono hl">${TARGET.reg}</span> (${TARGET.type}, ICAO <span class="mono">${TARGET.icao.toUpperCase()}</span>).`);
  logEvent("Terminal boot complete.");
  logEvent(`Querying public ADS-B feed for ${TARGET.reg}…`);

  pollLive();
  setInterval(pollLive, POLL_MS);
})();
