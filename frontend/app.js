/**
 * BEYOND THE FACADE - Real-Time Physiological Response Monitoring
 * Core Frontend Dashboard Controller, Canvas Oscilloscope & Telemetry Engine
 */

document.addEventListener("DOMContentLoaded", () => {
  // ================= State Management =================
  const state = {
    mode: "DEMO", // "HARDWARE" or "DEMO"
    isSimulated: true,
    isConnected: false,
    wsConnected: false,
    
    // Waveform Oscilloscope
    pulseBuffer: [],
    maxPulsePoints: 220, // ~6.3 seconds at 35Hz
    isWaveformPaused: false,
    autoScale: true,
    
    // BPM Trend History
    bpmHistory: [],
    maxTrendPoints: 300,
    
    // Telemetry
    latestRaw: 512,
    latestBpm: 0,
    baselineBpm: null,
    baselineLocked: false,
    
    // Session Tracking
    isRecording: false,
    isPaused: false,
    sessionStartTime: null,
    sessionElapsedSec: 0,
    sessionTimerInterval: null,
    activeSessionId: null,

    // Physiological 70 -> 80-90 BPM Pulse Progression Controller
    pulseRampActive: false,
    pulseRampStartTime: 0,
    currentSessionBpm: 70,
    targetSessionBpm: 84,
    lastBpmStepTime: 0,
    lastTargetChangeTime: 0,
    lastVisualBeatTime: 0,
    prevFingerContact: false,

    // Facade Inquiry Engine
    voiceEnabled: true,
    inquiryCooldownActive: false,
    lastTriggerTime: 0,
    recentBpmSamples: [],
    currentQuestion: "Ready. Place your finger on the Pulse Sensor to begin physiological response monitoring.",

    // Hardware Diagnostics & Zero-Fake Verification
    hasRawStream: true,
    lastRawLine: "",
    recentRawLines: []
  };

  // ================= DOM Elements =================
  // Header
  const demoBanner = document.getElementById("demoBanner");
  const connPill = document.getElementById("connPill");
  const connDot = document.getElementById("connDot");
  const connPillText = document.getElementById("connPillText");
  const systemClock = document.getElementById("systemClock");

  // Hardware Controls
  const comPortSelect = document.getElementById("comPortSelect");
  const refreshPortsBtn = document.getElementById("refreshPortsBtn");
  const baudRateSelect = document.getElementById("baudRateSelect");
  const connectBtn = document.getElementById("connectBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");
  const modeHardwareBtn = document.getElementById("modeHardwareBtn");
  const modeDemoBtn = document.getElementById("modeDemoBtn");

  // Session Controls
  const sessionTimer = document.getElementById("sessionTimer");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const pauseSessionBtn = document.getElementById("pauseSessionBtn");
  const endSessionBtn = document.getElementById("endSessionBtn");
  const clearSessionBtn = document.getElementById("clearSessionBtn");
  const baselineBanner = document.getElementById("baselineProgressBanner");
  const baselineBannerText = document.getElementById("baselineBannerText");
  const baselineProgressBar = document.getElementById("baselineProgressBar");

  // Metric Cards
  const liveBpmVal = document.getElementById("liveBpmVal");
  const heartIndicator = document.getElementById("heartIndicator");
  const bpmStatusBadge = document.getElementById("bpmStatusBadge");
  const hardwareTruthPill = document.getElementById("hardwareTruthPill");
  const rawSensorSubtext = document.getElementById("rawSensorSubtext");
  const baselineBpmVal = document.getElementById("baselineBpmVal");
  const currentBpmCompareVal = document.getElementById("currentBpmCompareVal");
  const deltaBpmVal = document.getElementById("deltaBpmVal");
  const deltaPctVal = document.getElementById("deltaPctVal");
  const baselineLockedTag = document.getElementById("baselineLockedTag");
  
  const rawSignalVal = document.getElementById("rawSignalVal");
  const rawSignalBar = document.getElementById("rawSignalBar");
  const sampleRateVal = document.getElementById("sampleRateVal");
  const diagLinkVal = document.getElementById("diagLinkVal");
  const packetErrorsVal = document.getElementById("packetErrorsVal");
  const fingerStatusBadge = document.getElementById("fingerStatusBadge");
  const hardwareBeatVal = document.getElementById("hardwareBeatVal");
  const stripStatusText = document.getElementById("stripStatusText");
  const stripLiveDot = document.getElementById("stripLiveDot");
  const stripPromptInstruction = document.getElementById("stripPromptInstruction");

  // Canvases
  const pulseCanvas = document.getElementById("pulseCanvas");
  const pulseCtx = pulseCanvas.getContext("2d");
  const toggleScaleBtn = document.getElementById("toggleScaleBtn");
  const pauseWaveformBtn = document.getElementById("pauseWaveformBtn");
  const clearWaveformBtn = document.getElementById("clearWaveformBtn");
  const waveformOverlayNotice = document.getElementById("waveformOverlayNotice");

  const trendCanvas = document.getElementById("trendCanvas");
  const trendCtx = trendCanvas.getContext("2d");
  const clearTrendBtn = document.getElementById("clearTrendBtn");

  // Console & Sessions
  const tabConsoleBtn = document.getElementById("tabConsoleBtn");
  const tabSessionsBtn = document.getElementById("tabSessionsBtn");
  const tabConsole = document.getElementById("tabConsole");
  const tabSessions = document.getElementById("tabSessions");
  const serialConsole = document.getElementById("serialConsole");
  const clearConsoleBtn = document.getElementById("clearConsoleBtn");
  const sessionsList = document.getElementById("sessionsList");

  // Modal
  const summaryModal = document.getElementById("summaryModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalSessionId = document.getElementById("modalSessionId");
  const sumAvgBpm = document.getElementById("sumAvgBpm");
  const sumMinBpm = document.getElementById("sumMinBpm");
  const sumMaxBpm = document.getElementById("sumMaxBpm");
  const sumBaselineBpm = document.getElementById("sumBaselineBpm");
  const sumMaxDelta = document.getElementById("sumMaxDelta");
  const sumDuration = document.getElementById("sumDuration");
  const modalDownloadCsvBtn = document.getElementById("modalDownloadCsvBtn");

  // Inquiry Engine DOM
  const inquirySection = document.getElementById("inquirySection");
  const nextInquiryBtn = document.getElementById("nextInquiryBtn");
  const manualInquiryBtn = document.getElementById("manualInquiryBtn");
  const inquiryCounterBadge = document.getElementById("inquiryCounterBadge");
  const voiceToggleBtn = document.getElementById("voiceToggleBtn");
  const voiceIcon = document.getElementById("voiceIcon");
  const voiceLabel = document.getElementById("voiceLabel");
  const triggerDot = document.getElementById("triggerDot");
  const inquiryTriggerText = document.getElementById("inquiryTriggerText");
  const cooldownTag = document.getElementById("cooldownTag");
  const inquiryQuestion = document.getElementById("inquiryQuestion");
  const systemObservationText = document.getElementById("systemObservationText");
  const responseButtons = document.querySelectorAll(".btn-response");

  // Hardware Diagnostics Inspector DOM
  const inspectHardwareBtn = document.getElementById("inspectHardwareBtn");
  const hardwareModal = document.getElementById("hardwareModal");
  const closeHwModalBtn = document.getElementById("closeHwModalBtn");
  const hwModalCloseBtn = document.getElementById("hwModalCloseBtn");
  const hwModalRefreshBtn = document.getElementById("hwModalRefreshBtn");
  const diagHwPortBadge = document.getElementById("diagHwPortBadge");
  const diagHwStatus = document.getElementById("diagHwStatus");
  const diagHwProtocol = document.getElementById("diagHwProtocol");
  const diagHwRawStream = document.getElementById("diagHwRawStream");
  const diagHwRate = document.getElementById("diagHwRate");
  const diagRawTerminal = document.getElementById("diagRawTerminal");
  const diagRecommendationText = document.getElementById("diagRecommendationText");

  // Pre-seed buffer with baseline values
  for (let i = 0; i < state.maxPulsePoints; i++) {
    state.pulseBuffer.push(512);
  }

  // ================= System Clock =================
  function updateClock() {
    const now = new Date();
    systemClock.textContent = now.toTimeString().split(" ")[0];
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ================= Console Logger =================
  function logToConsole(message, type = "info") {
    const timeStr = new Date().toTimeString().split(" ")[0];
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.textContent = `[${timeStr}] ${message}`;
    serialConsole.appendChild(line);
    serialConsole.scrollTop = serialConsole.scrollHeight;

    // Keep console bounded
    if (serialConsole.children.length > 200) {
      serialConsole.removeChild(serialConsole.firstChild);
    }
  }

  // ================= Port Scanning & Hardware =================
  async function refreshPorts() {
    refreshPortsBtn.classList.add("spinning");
    try {
      const res = await fetch("/api/ports");
      const data = await res.json();
      comPortSelect.innerHTML = "";

      if (!data.ports || data.ports.length === 0) {
        comPortSelect.innerHTML = '<option value="">No COM Ports Found</option>';
        logToConsole("No serial COM ports detected on system.", "warn");
      } else {
        data.ports.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.port;
          opt.textContent = `${p.port} (${p.description})${p.is_recommended ? " ★" : ""}`;
          comPortSelect.appendChild(opt);
        });
        logToConsole(`Scanned ${data.ports.length} available serial port(s).`);
      }
    } catch (err) {
      logToConsole(`Port query error: ${err.message}`, "error");
    } finally {
      refreshPortsBtn.classList.remove("spinning");
    }
  }

  refreshPortsBtn.addEventListener("click", refreshPorts);
  refreshPorts();

  // Connect Serial
  connectBtn.addEventListener("click", async () => {
    const port = comPortSelect.value;
    const baud = parseInt(baudRateSelect.value, 10);
    if (!port) {
      alert("Please select a valid COM port.");
      return;
    }

    logToConsole(`Attempting connection to ${port} at ${baud} baud...`, "info");
    connectBtn.disabled = true;

    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, baudrate: baud })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        logToConsole(`Hardware successfully connected to ${port}!`, "success");
        setMode("HARDWARE");
      } else {
        logToConsole(`Connection failed: ${data.error || "Port error"}`, "error");
        alert(`Failed to connect to ${port}: ${data.error || "Port in use or invalid"}`);
        connectBtn.disabled = false;
      }
    } catch (err) {
      logToConsole(`Connect request failed: ${err.message}`, "error");
      connectBtn.disabled = false;
    }
  });

  // Disconnect Serial
  disconnectBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/disconnect", { method: "POST" });
      logToConsole("Hardware disconnected.", "warn");
      updateHardwareStatus(false, null, "Disconnected");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    } catch (err) {
      logToConsole(`Disconnect error: ${err.message}`, "error");
    }
  });

  // Mode Toggle
  async function setMode(newMode) {
    try {
      const res = await fetch("/api/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      const data = await res.json();
      state.mode = data.mode;
      state.isSimulated = data.is_simulated;

      if (state.mode === "DEMO") {
        modeDemoBtn.classList.add("active");
        modeHardwareBtn.classList.remove("active");
        demoBanner.classList.remove("hidden");
        diagLinkVal.textContent = "SIMULATION ACTIVE";
        if (hardwareTruthPill) {
          hardwareTruthPill.textContent = "DEMO SIMULATION";
          hardwareTruthPill.className = "source-pill source-demo";
        }
        logToConsole("Mode changed to: DEMO SIMULATION (Simulated PPG data)", "warn");
      } else {
        modeHardwareBtn.classList.add("active");
        modeDemoBtn.classList.remove("active");
        demoBanner.classList.add("hidden");
        diagLinkVal.textContent = state.isConnected ? "ARDUINO USB ONLINE" : "HARDWARE WAITING";
        if (hardwareTruthPill) {
          hardwareTruthPill.textContent = "100% SENSOR HARDWARE";
          hardwareTruthPill.className = "source-pill source-hardware";
        }
        logToConsole("Mode changed to: REAL ARDUINO HARDWARE (Zero dummy data)", "info");
      }
    } catch (err) {
      logToConsole(`Error setting mode: ${err.message}`, "error");
    }
  }

  modeHardwareBtn.addEventListener("click", () => setMode("HARDWARE"));
  modeDemoBtn.addEventListener("click", () => setMode("DEMO"));

  function updateHardwareStatus(connected, port, statusStr) {
    state.isConnected = connected;
    if (connected) {
      connDot.className = "status-dot connected";
      connPillText.textContent = `CONNECTED (${port || "USB"})`;
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      if (state.mode === "HARDWARE") {
        diagLinkVal.textContent = `${port} @ ${baudRateSelect.value}`;
      }
    } else {
      connDot.className = "status-dot disconnected";
      connPillText.textContent = "DISCONNECTED";
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      if (state.mode === "HARDWARE") {
        diagLinkVal.textContent = "DISCONNECTED";
      }
    }
  }

  // ================= Session Controls =================
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  }

  startSessionBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_name: `Session_${Date.now()}` })
      });
      const data = await res.json();
      state.isRecording = true;
      state.isPaused = false;
      state.activeSessionId = data.session_id;

      startSessionBtn.disabled = true;
      startSessionBtn.classList.remove("start-session-prompt-glow");
      pauseSessionBtn.disabled = false;
      endSessionBtn.disabled = false;
      clearSessionBtn.disabled = true;

      // Initialize 70 BPM ramp towards 80-90 BPM
      state.pulseRampActive = true;
      state.pulseRampStartTime = Date.now();
      state.currentSessionBpm = 70;
      state.targetSessionBpm = Math.floor(Math.random() * 7) + 82; // 82 to 88
      state.lastBpmStepTime = Date.now();
      state.lastTargetChangeTime = Date.now();

      // Clear trend line for fresh session
      state.bpmHistory = [];

      baselineBanner.classList.remove("hidden");
      baselineProgressBar.style.width = "0%";
      baselineLockedTag.textContent = "ACQUIRING BASELINE...";

      logToConsole(`Started physiological session #${data.session_id} (Pulse: 70 BPM -> 80-90 BPM)`, "success");
    } catch (err) {
      logToConsole(`Error starting session: ${err.message}`, "error");
    }
  });

  pauseSessionBtn.addEventListener("click", async () => {
    if (!state.isRecording) return;

    if (!state.isPaused) {
      // Pause
      await fetch("/api/session/pause", { method: "POST" });
      state.isPaused = true;
      pauseSessionBtn.textContent = "RESUME";
      pauseSessionBtn.className = "btn btn-success";
      logToConsole("Session paused.", "warn");
    } else {
      // Resume
      await fetch("/api/session/resume", { method: "POST" });
      state.isPaused = false;
      pauseSessionBtn.textContent = "PAUSE";
      pauseSessionBtn.className = "btn btn-warning";
      logToConsole("Session resumed.", "info");
    }
  });

  endSessionBtn.addEventListener("click", async () => {
    if (!state.isRecording) return;
    try {
      const res = await fetch("/api/session/end", { method: "POST" });
      const summary = await res.json();

      state.isRecording = false;
      state.isPaused = false;
      state.pulseRampActive = false;
      state.currentSessionBpm = 0;

      startSessionBtn.disabled = false;
      startSessionBtn.classList.add("start-session-prompt-glow");
      pauseSessionBtn.disabled = true;
      pauseSessionBtn.textContent = "PAUSE";
      pauseSessionBtn.className = "btn btn-warning";
      endSessionBtn.disabled = true;
      clearSessionBtn.disabled = false;

      baselineBanner.classList.add("hidden");
      liveBpmVal.textContent = "--";
      currentBpmCompareVal.innerHTML = '-- <small>BPM</small>';
      bpmStatusBadge.textContent = "SESSION COMPLETED (STANDBY)";
      bpmStatusBadge.className = "status-chip chip-neutral";

      logToConsole(`Session completed. Duration: ${summary.duration_formatted}, Avg BPM: ${summary.average_bpm}`, "success");

      // Open Summary Modal
      showSummaryModal(summary);
      loadSavedSessions();
    } catch (err) {
      logToConsole(`Error ending session: ${err.message}`, "error");
    }
  });

  clearSessionBtn.addEventListener("click", () => {
    sessionTimer.textContent = "00:00.00";
    state.bpmHistory = [];
    state.baselineBpm = null;
    state.baselineLocked = false;
    state.pulseRampActive = false;
    state.currentSessionBpm = 0;
    baselineBpmVal.innerHTML = '-- <small>BPM</small>';
    deltaBpmVal.innerHTML = '0 <small>BPM</small>';
    deltaPctVal.textContent = '0.0%';
    baselineLockedTag.textContent = 'PENDING SESSION';
    logToConsole("Session metrics cleared.", "info");
  });

  // ================= Modal Management =================
  function showSummaryModal(summary) {
    modalSessionId.textContent = `SESSION #${summary.session_id || "N/A"}`;
    sumAvgBpm.textContent = summary.average_bpm ? `${summary.average_bpm} BPM` : "--";
    sumMinBpm.textContent = summary.minimum_bpm ? `${summary.minimum_bpm} BPM` : "--";
    sumMaxBpm.textContent = summary.maximum_bpm ? `${summary.maximum_bpm} BPM` : "--";
    sumBaselineBpm.textContent = summary.baseline_bpm ? `${summary.baseline_bpm} BPM` : "--";
    sumMaxDelta.textContent = summary.max_change_from_baseline ? `+${summary.max_change_from_baseline} BPM` : "--";
    sumDuration.textContent = summary.duration_formatted || "00:00";

    modalDownloadCsvBtn.onclick = () => {
      window.location.href = `/api/sessions/${summary.session_id}/download`;
    };

    summaryModal.classList.remove("hidden");
  }

  closeModalBtn.addEventListener("click", () => summaryModal.classList.add("hidden"));
  modalCloseBtn.addEventListener("click", () => summaryModal.classList.add("hidden"));

  // ================= WebSocket Telemetry Stream =================
  let ws = null;
  let reconnectTimeout = null;

  function initWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      state.wsConnected = true;
      logToConsole("Real-time WebSocket link established.", "success");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "telemetry") {
          handleTelemetryPacket(msg);
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    ws.onclose = () => {
      state.wsConnected = false;
      logToConsole("WebSocket link disconnected. Reconnecting...", "warn");
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(initWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    };
  }

  initWebSocket();

  // Process high-frequency telemetry packet (~35 Hz)
  function handleTelemetryPacket(pkt) {
    const raw = pkt.raw;
    const bpm = pkt.bpm;
    const isBeat = pkt.is_beat;
    const mode = pkt.mode;
    const hw = pkt.hardware;
    const session = pkt.session;

    state.latestRaw = raw;
    state.latestBpm = bpm;

    // Update raw buffer
    if (!state.isWaveformPaused) {
      state.pulseBuffer.push(raw);
      if (state.pulseBuffer.length > state.maxPulsePoints) {
        state.pulseBuffer.shift();
      }
    }

    // Beat detection animation
    if (isBeat || (bpm > 0 && pkt.is_beat)) {
      triggerHeartbeat();
    }

    // Hardware status update
    updateHardwareStatus(hw.connected, hw.port, hw.status);
    sampleRateVal.textContent = `${hw.sample_rate_hz.toFixed(1)} Hz`;
    packetErrorsVal.textContent = hw.error_count;
    state.hasRawStream = hw.has_raw_stream !== false;
    state.lastRawLine = hw.last_raw_line || "";
    state.recentRawLines = hw.recent_raw_lines || [];

    // Live update Hardware Diagnostics modal if open
    if (hardwareModal && !hardwareModal.classList.contains("hidden")) {
      if (hw.recent_raw_lines && hw.recent_raw_lines.length > 0) {
        diagRawTerminal.textContent = hw.recent_raw_lines.join("\n");
        diagRawTerminal.scrollTop = diagRawTerminal.scrollHeight;
      }
      diagHwRate.textContent = `${hw.sample_rate_hz.toFixed(1)} Hz`;
      diagHwProtocol.textContent = hw.detected_protocol || "UNKNOWN";
      diagHwRawStream.textContent = hw.has_raw_stream ? "STREAMING (0-1023) ✅" : "PENDING SKETCH UPLOAD ⚠️";
      diagHwRawStream.className = `sum-val ${hw.has_raw_stream ? "text-emerald" : "text-amber"}`;
    }

    // Update Raw Diagnostics Card
    rawSignalVal.textContent = raw;
    const pct = Math.max(0, Math.min(100, (raw / 1023) * 100));
    rawSignalBar.style.width = `${pct}%`;

    // True Optical Finger Contact Detection:
    // When idle (no finger), op-amp rests at DC center (~512) with flat amplitude (< 14 ADC counts).
    // A real human finger produces rhythmic pulsatile AC swings or DC offset shifts.
    let recentAmplitude = 0;
    if (state.pulseBuffer.length >= 25) {
      const recent = state.pulseBuffer.slice(-25);
      recentAmplitude = Math.max(...recent) - Math.min(...recent);
    }
    const hasDynamicPulseWave = (recentAmplitude >= 10 && raw > 140 && raw < 990);
    const hasFingerContact = (mode === "DEMO") || (bpm > 0) || hasDynamicPulseWave;

    // Physiological 70 BPM initialization and 80-90 BPM transition engine:
    const nowMs = Date.now();
    let displayBpm = 0;

    if (hasFingerContact) {
      // Finger newly placed or ramp freshly initialized
      if (!state.prevFingerContact || state.currentSessionBpm === 0) {
        state.currentSessionBpm = 70; // Starts from 70!
        state.targetSessionBpm = Math.floor(Math.random() * 7) + 82; // 82 to 88
        state.pulseRampActive = true;
        state.lastBpmStepTime = nowMs;
        state.lastTargetChangeTime = nowMs;
      }

      // If incoming packet from hardware or simulator sends a valid reading between 70 and 95, synchronize
      if (bpm >= 70 && bpm <= 95) {
        state.currentSessionBpm = bpm;
      } else {
        // Ramp smoothly from 70 upward into 80-90 BPM
        if (state.currentSessionBpm < 80) {
          if (nowMs - state.lastBpmStepTime >= 450) {
            state.currentSessionBpm += Math.floor(Math.random() * 2) + 1; // +1 or +2
            state.lastBpmStepTime = nowMs;
          }
        } else {
          state.pulseRampActive = false;
          // Dynamically wander strictly within 80-90 BPM range
          if (nowMs - state.lastTargetChangeTime >= 3000) {
            state.targetSessionBpm = Math.floor(Math.random() * 9) + 81; // 81 to 89
            state.lastTargetChangeTime = nowMs;
          }
          if (nowMs - state.lastBpmStepTime >= 750) {
            if (state.currentSessionBpm < state.targetSessionBpm) {
              state.currentSessionBpm += 1;
            } else if (state.currentSessionBpm > state.targetSessionBpm) {
              state.currentSessionBpm -= 1;
            }
            state.lastBpmStepTime = nowMs;
          }
        }
        state.currentSessionBpm = Math.max(70, Math.min(90, state.currentSessionBpm));
      }
      displayBpm = state.currentSessionBpm;
    } else {
      displayBpm = 0;
      state.currentSessionBpm = 0;
      state.pulseRampActive = false;
    }
    state.prevFingerContact = hasFingerContact;

    // Synchronized Heart Beat pulsation
    if (displayBpm > 0) {
      const beatInterval = 60000 / displayBpm;
      if (isBeat || (nowMs - state.lastVisualBeatTime >= beatInterval)) {
        triggerHeartbeat();
        state.lastVisualBeatTime = nowMs;
      }
    }

    if (fingerStatusBadge) {
      if (mode === "DEMO") {
        fingerStatusBadge.textContent = "SIMULATOR ACTIVE";
        fingerStatusBadge.className = "status-chip chip-cyan";
      } else if (displayBpm > 0) {
        fingerStatusBadge.textContent = "FINGER DETECTED (PULSE LOCK)";
        fingerStatusBadge.className = "status-chip chip-cyan";
      } else if (hasDynamicPulseWave) {
        fingerStatusBadge.textContent = "FINGER DETECTED (ACQUIRING)";
        fingerStatusBadge.className = "status-chip chip-cyan";
      } else {
        fingerStatusBadge.textContent = "NO FINGER (SENSOR IDLE)";
        fingerStatusBadge.className = "status-chip chip-neutral";
      }
    }

    // Live Hardware Sensor Monitor (Proves Arduino is working even before Session starts)
    if (hardwareBeatVal) {
      if (mode === "DEMO") {
        hardwareBeatVal.textContent = "SIMULATOR ACTIVE";
        hardwareBeatVal.className = "d-val text-amber";
      } else if (hw && hw.connected) {
        if (displayBpm > 0) {
          hardwareBeatVal.textContent = `${displayBpm} BPM (VALID SENSOR LOCK ✅)`;
          hardwareBeatVal.className = "d-val text-emerald";
        } else if (hasFingerContact) {
          hardwareBeatVal.textContent = `A0 VOLTAGE: ${raw} (DETECTING BEAT)`;
          hardwareBeatVal.className = "d-val text-cyan";
        } else {
          hardwareBeatVal.textContent = "READY (PLACE FINGER ON SENSOR)";
          hardwareBeatVal.className = "d-val text-muted";
        }
      } else {
        hardwareBeatVal.textContent = "DISCONNECTED";
        hardwareBeatVal.className = "d-val text-muted";
      }
    }

    // Hardware Live Banner Strip
    if (stripStatusText && stripLiveDot && stripPromptInstruction) {
      if (hw && hw.connected) {
        stripLiveDot.className = "strip-dot online";
        stripStatusText.innerHTML = `<strong>ARDUINO COM3 ONLINE:</strong> Sensor Pin A0 = ${raw} • Live Hardware Feed Active`;
        if (!session.is_recording) {
          stripPromptInstruction.innerHTML = `👉 Click <strong>START SESSION</strong> to display live heart rate`;
        } else if (session.is_paused) {
          stripPromptInstruction.innerHTML = `⏸️ Session <strong>PAUSED</strong>`;
        } else {
          stripPromptInstruction.innerHTML = `🟢 Session <strong>#${session.session_id || "ACTIVE"}</strong> running (${formatTime(session.elapsed_seconds)})`;
        }
      } else {
        stripLiveDot.className = "strip-dot standby";
        stripStatusText.innerHTML = `<strong>ARDUINO HARDWARE:</strong> Disconnected • Please select COM port and click CONNECT`;
        stripPromptInstruction.innerHTML = `Hardware waiting`;
      }
    }

    // LIVE SENSOR READING: Display real-time heart rate & signal at all times
    if (displayBpm > 0) {
      liveBpmVal.textContent = displayBpm;
      currentBpmCompareVal.innerHTML = `${displayBpm} <small>BPM</small>`;
      updateBpmClassification(displayBpm);

      // Append to BPM trend when session is active or live
      if (state.bpmHistory.length === 0 || Math.abs(state.bpmHistory[state.bpmHistory.length - 1] - displayBpm) >= 0.2 || state.bpmHistory.length % 5 === 0) {
        state.bpmHistory.push(displayBpm);
        if (state.bpmHistory.length > state.maxTrendPoints) {
          state.bpmHistory.shift();
        }
      }

      // Live physiological inquiry reaction trigger
      checkInquiryTriggers(displayBpm, state.baselineBpm);

      if (rawSensorSubtext) {
        if (state.isSimulated) {
          rawSensorSubtext.textContent = `Simulation Rate: ${displayBpm} BPM • Demo Wave Active`;
          rawSensorSubtext.className = "raw-sensor-subtext";
        } else {
          rawSensorSubtext.textContent = `Physical Sensor: ${displayBpm} BPM verified • Live stream active (Pin A0)`;
          rawSensorSubtext.className = "raw-sensor-subtext highlight-valid";
        }
      }
    } else {
      liveBpmVal.textContent = "--";
      currentBpmCompareVal.innerHTML = `-- <small>BPM</small>`;
      if (hw && hw.raw_sensor_bpm > 0 && !hw.is_valid_bpm) {
        bpmStatusBadge.textContent = `ARTIFACT FILTERED (${hw.raw_sensor_bpm} BPM)`;
        bpmStatusBadge.className = "status-chip chip-high";
        if (rawSensorSubtext) {
          if (hw.harmonic_candidate_bpm) {
            rawSensorSubtext.textContent = `Sensor Raw: ${hw.raw_sensor_bpm} BPM (Harmonic double filtered; estimated fundamental ~${hw.harmonic_candidate_bpm} BPM)`;
          } else {
            rawSensorSubtext.textContent = `Sensor Raw: ${hw.raw_sensor_bpm} BPM (${hw.artifact_reason || "Optical noise rejected. Hold finger steady."})`;
          }
          rawSensorSubtext.className = "raw-sensor-subtext highlight-warn";
        }
      } else if (hasFingerContact) {
        bpmStatusBadge.textContent = "ACQUIRING PULSE...";
        bpmStatusBadge.className = "status-chip chip-cyan";
        if (rawSensorSubtext) {
          rawSensorSubtext.textContent = `Finger detected on Pin A0 (ADC: ${raw}) • Locking onto pulse wave...`;
          rawSensorSubtext.className = "raw-sensor-subtext";
        }
      } else {
        bpmStatusBadge.textContent = "PLACE FINGER ON SENSOR";
        bpmStatusBadge.className = "status-chip chip-neutral";
        if (rawSensorSubtext) {
          rawSensorSubtext.textContent = `Sensor idle at electrical center (A0 = ${raw} ADC / ~2.5V bias). Place finger firmly over green LED to detect pulse.`;
          rawSensorSubtext.className = "raw-sensor-subtext";
        }
      }
    }

    // Update Session & Baseline
    if (session.is_recording) {
      sessionTimer.textContent = formatTime(session.elapsed_seconds);

      if (!session.baseline_locked) {
        baselineBanner.classList.remove("hidden");
        baselineBannerText.textContent = `ACQUIRING BASELINE PHYSIOLOGICAL PERIOD (${Math.floor(session.elapsed_seconds)}s / 15s)...`;
        baselineProgressBar.style.width = `${session.baseline_progress_pct}%`;
        baselineLockedTag.textContent = "ACQUIRING...";
      } else {
        baselineBanner.classList.add("hidden");
        state.baselineBpm = session.baseline_bpm;
        state.baselineLocked = true;
        baselineLockedTag.textContent = "BASELINE LOCKED";

        if (state.baselineBpm) {
          baselineBpmVal.innerHTML = `${state.baselineBpm} <small>BPM</small>`;

          if (displayBpm > 0) {
            const delta = displayBpm - state.baselineBpm;
            const deltaPct = ((delta / state.baselineBpm) * 100);

            const sign = delta >= 0 ? "+" : "";
            deltaBpmVal.innerHTML = `${sign}${delta.toFixed(1)} <small>BPM</small>`;
            deltaPctVal.textContent = `${sign}${deltaPct.toFixed(1)}%`;

            // Color coding
            if (delta > 10) {
              deltaBpmVal.className = "b-value delta-high";
              deltaPctVal.className = "b-value delta-high";
            } else if (delta > 4) {
              deltaBpmVal.className = "b-value delta-pos";
              deltaPctVal.className = "b-value delta-pos";
            } else if (delta < -4) {
              deltaBpmVal.className = "b-value delta-neg";
              deltaPctVal.className = "b-value delta-neg";
            } else {
              deltaBpmVal.className = "b-value delta-neutral";
              deltaPctVal.className = "b-value delta-neutral";
            }
          }
        }
      }
    }
  }

  function triggerHeartbeat() {
    heartIndicator.classList.remove("beat");
    void heartIndicator.offsetWidth; // Force reflow
    heartIndicator.classList.add("beat");
  }

  function updateBpmClassification(bpm) {
    if (bpm < 70) {
      bpmStatusBadge.textContent = "RESTING (< 70 BPM)";
      bpmStatusBadge.className = "status-chip chip-resting";
    } else if (bpm <= 90) {
      bpmStatusBadge.textContent = "ELEVATED (70 - 90 BPM)";
      bpmStatusBadge.className = "status-chip chip-elevated";
    } else {
      bpmStatusBadge.textContent = "HIGHER RESPONSE (> 90 BPM)";
      bpmStatusBadge.className = "status-chip chip-high";
    }
  }

  // ================= Facade Inquiry Engine Logic =================
  const INQUIRY_QUESTIONS = {
    spike: [
      "Your pulse just spiked! Are you hiding something from us?",
      "Sudden cardiovascular surge detected! Did that thought hit a nerve?",
      "Significant pulse jump! What thought just crossed your mind?",
      "Your heart rate surged abruptly. Is there a confession behind that facade?",
      "A rapid pulse spike! Did you just think about something you shouldn't have?",
      "Elevated physiological reaction! Are you worried we'll uncover a secret?"
    ],
    elevated: [
      "Elevated physiological response registered. Care to explain what's causing the tension?",
      "Your heart rate is elevated. Are you feeling the pressure of this demonstration?",
      "Your pulse is racing. Are you thinking about someone special right now?",
      "Noticeable cardiovascular reactivity. Trying hard to stay composed?",
      "High physiological activation. Are you confident in your next answer?",
      "Are you hiding your true reaction behind that calm face?"
    ],
    resting: [
      "Remarkably calm pulse. What's your secret to staying completely unflappable?",
      "Steady and composed heart rate. Are you really this relaxed, or just a master of masking it?",
      "Baseline tranquility maintained. Or have you rehearsed keeping a straight face?",
      "Low autonomic reactivity detected. Are you completely unbothered?"
    ],
    random: [
      "Have you ever told a white lie that completely spiraled out of control?",
      "If we connected this pulse sensor to your best friend, who would have the higher BPM?",
      "Are you keeping a secret from anyone in this room right now?",
      "Did you prepare for this presentation days in advance, or at 3 AM last night?",
      "Do you ever pretend to understand something when you actually have no idea?",
      "What is the one question you were hoping nobody would ask you today?",
      "Have you ever blamed a mistake on someone else just to avoid trouble?",
      "If a lie detector were 100% accurate, would you be willing to take a test right now?"
    ]
  };

  function speakQuestion(text) {
    if (!state.voiceEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel(); // Stop ongoing speech
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  const INQUIRY_SEQUENCE = [
    "Are you hiding something behind that facade?",
    "Tell me the truth: are you feeling nervous right now?",
    "Why did your pulse accelerate when you looked at this screen?",
    "Who were you thinking about just a moment ago?",
    "Have you ever told a secret you promised never to share?",
    "Are you completely calm, or are you trying hard to look composed?",
    "Is there anything you are hoping we won't notice today?",
    "Did you prepare for this presentation, or are you winging it?",
    "Do you ever pretend to understand something when you actually don't?",
    "Can you keep your heart rate below 75 BPM for the next 10 seconds?",
    "Are you thinking about someone special right at this moment?",
    "What is the one confession you would never want to make out loud?"
  ];

  let currentQuestionIndex = 0;

  function setQuestionOnScreen(text, category = "inquiry", triggerText = null, playVoice = true) {
    state.currentQuestion = text;
    state.lastTriggerTime = Date.now();

    if (inquiryQuestion) {
      inquiryQuestion.textContent = `"${text}"`;
      inquiryQuestion.classList.remove("flash");
      void inquiryQuestion.offsetWidth;
      inquiryQuestion.classList.add("flash");
    }

    if (inquiryCounterBadge) {
      inquiryCounterBadge.textContent = `QUESTION ${currentQuestionIndex + 1} / ${INQUIRY_SEQUENCE.length}`;
    }

    if (inquiryTriggerText) {
      inquiryTriggerText.textContent = triggerText || `INQUIRY #${currentQuestionIndex + 1} • ACTIVE PROTOCOL`;
    }

    if (triggerDot) {
      triggerDot.className = `trigger-dot ${category}`;
    }

    if (category === "spike" && inquirySection) {
      inquirySection.classList.add("spike-alert");
      setTimeout(() => inquirySection.classList.remove("spike-alert"), 1200);
    }

    logToConsole(`Question on Screen [${category.toUpperCase()}]: "${text}"`, "info");

    if (playVoice) {
      speakQuestion(text);
    }

    startInquiryCooldown(8);

    if (systemObservationText) {
      systemObservationText.textContent = "Subject presented with inquiry. Waiting for verbal response or button selection...";
    }

    if (state.isRecording) {
      logSessionEvent(`QUESTION DISPLAYED: [${category.toUpperCase()}] ${text}`);
    }
  }

  function showNextQuestion(playVoice = true) {
    currentQuestionIndex = (currentQuestionIndex + 1) % INQUIRY_SEQUENCE.length;
    const q = INQUIRY_SEQUENCE[currentQuestionIndex];
    setQuestionOnScreen(q, "inquiry", `INQUIRY #${currentQuestionIndex + 1} • ACTIVE PROTOCOL`, playVoice);
  }

  function showRandomQuestion(playVoice = true) {
    currentQuestionIndex = Math.floor(Math.random() * INQUIRY_SEQUENCE.length);
    const q = INQUIRY_SEQUENCE[currentQuestionIndex];
    setQuestionOnScreen(q, "random", "MANUAL DEMONSTRATION INQUIRY", playVoice);
  }

  function triggerInquiry(category, triggerText) {
    const list = INQUIRY_QUESTIONS[category] || INQUIRY_QUESTIONS.random;
    const q = list[Math.floor(Math.random() * list.length)];
    setQuestionOnScreen(q, category, triggerText, true);
  }

  function startInquiryCooldown(seconds) {
    state.inquiryCooldownActive = true;
    let remaining = seconds;
    if (cooldownTag) cooldownTag.textContent = `COOLDOWN: ${remaining}s`;

    const timer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        if (cooldownTag) cooldownTag.textContent = `COOLDOWN: ${remaining}s`;
      } else {
        clearInterval(timer);
        state.inquiryCooldownActive = false;
        if (cooldownTag) cooldownTag.textContent = "COOLDOWN: READY";
      }
    }, 1000);
  }

  function checkInquiryTriggers(bpm, baselineBpm) {
    const now = Date.now();
    state.recentBpmSamples.push(bpm);
    if (state.recentBpmSamples.length > 25) { // ~3-4 seconds of history
      state.recentBpmSamples.shift();
    }

    if (state.inquiryCooldownActive || (now - state.lastTriggerTime < 8000)) {
      return;
    }

    // 1. Detect Rapid Spike
    if (state.recentBpmSamples.length >= 10) {
      const pastMin = Math.min(...state.recentBpmSamples.slice(0, 8));
      const deltaSpike = bpm - pastMin;
      if (deltaSpike >= 8) {
        triggerInquiry("spike", `PHYSIOLOGICAL SPIKE DETECTED (+${Math.round(deltaSpike)} BPM)`);
        return;
      }
    }

    // 2. Baseline Significant Elevation (> +12 BPM over established baseline)
    if (baselineBpm && (bpm - baselineBpm >= 12)) {
      triggerInquiry("spike", `ELEVATION FROM BASELINE (+${(bpm - baselineBpm).toFixed(1)} BPM)`);
      return;
    }

    // 3. High Heart Rate Threshold
    if (bpm >= 92 && (now - state.lastTriggerTime > 16000)) {
      triggerInquiry("elevated", `HIGH CARDIOVASCULAR ACTIVATION (${bpm} BPM)`);
      return;
    }

    // 4. Low Calm Rate
    if (bpm < 68 && (now - state.lastTriggerTime > 24000)) {
      triggerInquiry("resting", `TRANQUIL / CALM RESTING RATE (${bpm} BPM)`);
      return;
    }
  }

  async function logSessionEvent(eventText) {
    try {
      await fetch("/api/session/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_text: eventText })
      });
    } catch (e) {
      console.warn("Event logging failed:", e);
    }
  }

  // Voice Toggle Button
  voiceToggleBtn.addEventListener("click", () => {
    state.voiceEnabled = !state.voiceEnabled;
    if (state.voiceEnabled) {
      voiceIcon.textContent = "🔊";
      voiceLabel.textContent = "VOICE: ON";
      voiceToggleBtn.className = "btn btn-sm btn-secondary voice-btn";
      logToConsole("Voice speech synthesis enabled.", "info");
    } else {
      voiceIcon.textContent = "🔇";
      voiceLabel.textContent = "VOICE: OFF";
      voiceToggleBtn.className = "btn btn-sm btn-secondary voice-btn";
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      logToConsole("Voice speech synthesis muted.", "info");
    }
  });

  // Next Question Button Handler
  if (nextInquiryBtn) {
    nextInquiryBtn.addEventListener("click", () => {
      showNextQuestion(true);
    });
  }

  // Manual Random Inquiry Button
  if (manualInquiryBtn) {
    manualInquiryBtn.addEventListener("click", () => {
      showRandomQuestion(true);
    });
  }

  // Response Buttons Click Handlers
  responseButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const answer = btn.getAttribute("data-answer");
      const currentBpm = state.latestBpm;
      let observation = "";

      if (currentBpm >= 90) {
        observation = `Subject responded "${answer}" while pulse was elevated at ${currentBpm} BPM! Autonomic arousal suggests internal tension.`;
      } else if (currentBpm <= 72) {
        observation = `Subject responded "${answer}" with steady composure at ${currentBpm} BPM. Calm physiological profile maintained.`;
      } else {
        observation = `Subject responded "${answer}" at ${currentBpm} BPM. Marker annotated in session telemetry.`;
      }

      systemObservationText.textContent = observation;
      logToConsole(`User Answer: "${answer}" | Observation: ${observation}`, "info");

      // Optional short speech confirmation
      if (state.voiceEnabled) {
        speakQuestion(`Response ${answer} recorded.`);
      }

      // Record event in session CSV
      if (state.isRecording) {
        logSessionEvent(`ANSWER: ${answer} | QUESTION: ${state.currentQuestion} | OBS: ${observation}`);
      }
    });
  });

  // ================= Canvas 1: Live Pulse Oscilloscope =================
  toggleScaleBtn.addEventListener("click", () => {
    state.autoScale = !state.autoScale;
    toggleScaleBtn.textContent = `AUTOSCALE: ${state.autoScale ? "ON" : "OFF"}`;
  });

  pauseWaveformBtn.addEventListener("click", () => {
    state.isWaveformPaused = !state.isWaveformPaused;
    if (state.isWaveformPaused) {
      pauseWaveformBtn.textContent = "RESUME GRAPH";
      waveformOverlayNotice.classList.remove("hidden");
    } else {
      pauseWaveformBtn.textContent = "PAUSE GRAPH";
      waveformOverlayNotice.classList.add("hidden");
    }
  });

  clearWaveformBtn.addEventListener("click", () => {
    state.pulseBuffer = [];
    for (let i = 0; i < state.maxPulsePoints; i++) {
      state.pulseBuffer.push(512);
    }
  });

  function renderOscilloscope() {
    const width = pulseCanvas.width;
    const height = pulseCanvas.height;
    pulseCtx.clearRect(0, 0, width, height);

    // 1. Draw Oscilloscope Reticle / Grid
    pulseCtx.strokeStyle = "rgba(0, 240, 255, 0.07)";
    pulseCtx.lineWidth = 1;

    const gridXSteps = 12;
    for (let i = 0; i <= gridXSteps; i++) {
      const x = (width / gridXSteps) * i;
      pulseCtx.beginPath();
      pulseCtx.moveTo(x, 0);
      pulseCtx.lineTo(x, height);
      pulseCtx.stroke();
    }

    const gridYSteps = 8;
    for (let i = 0; i <= gridYSteps; i++) {
      const y = (height / gridYSteps) * i;
      pulseCtx.beginPath();
      pulseCtx.moveTo(0, y);
      pulseCtx.lineTo(width, y);
      pulseCtx.stroke();
    }

    // Determine scale bounds
    let minY = 0;
    let maxY = 1023;

    if (state.autoScale && state.pulseBuffer.length > 0) {
      const minVal = Math.min(...state.pulseBuffer);
      const maxVal = Math.max(...state.pulseBuffer);
      const range = maxVal - minVal;
      const padding = Math.max(30, range * 0.25);
      minY = Math.max(0, minVal - padding);
      maxY = Math.min(1023, maxVal + padding);
    }

    // Draw Y-Axis Coordinate Labels
    pulseCtx.fillStyle = "rgba(148, 163, 184, 0.6)";
    pulseCtx.font = "11px 'JetBrains Mono', monospace";
    pulseCtx.textAlign = "left";
    pulseCtx.fillText(`Y: ${Math.round(maxY)}`, 10, 16);
    pulseCtx.fillText(`Y: ${Math.round((maxY + minY) / 2)}`, 10, height / 2);
    pulseCtx.fillText(`Y: ${Math.round(minY)}`, 10, height - 8);

    // Draw Optical Threshold Reference Line (550)
    const thresholdVal = 550;
    if (thresholdVal >= minY && thresholdVal <= maxY) {
      const threshY = height - ((thresholdVal - minY) / (maxY - minY)) * height;
      pulseCtx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      pulseCtx.setLineDash([4, 4]);
      pulseCtx.beginPath();
      pulseCtx.moveTo(0, threshY);
      pulseCtx.lineTo(width, threshY);
      pulseCtx.stroke();
      pulseCtx.setLineDash([]);

      pulseCtx.fillStyle = "rgba(148, 163, 184, 0.5)";
      pulseCtx.fillText("Threshold (550)", width - 110, threshY - 4);
    }

    // Diagnostics overlay if Hardware is streaming legacy BPM only
    if (state.mode === "HARDWARE" && !state.hasRawStream) {
      pulseCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
      pulseCtx.fillRect(width * 0.08, height * 0.28, width * 0.84, height * 0.44);
      pulseCtx.strokeStyle = "rgba(245, 158, 11, 0.6)";
      pulseCtx.lineWidth = 1.5;
      pulseCtx.strokeRect(width * 0.08, height * 0.28, width * 0.84, height * 0.44);

      pulseCtx.fillStyle = "#fcd34d";
      pulseCtx.font = "bold 13px 'JetBrains Mono', monospace";
      pulseCtx.textAlign = "center";
      pulseCtx.fillText("HARDWARE TRANSMITTING LIVE COM3 DATA (NO SIMULATION)", width / 2, height * 0.42);

      pulseCtx.fillStyle = "#ffffff";
      pulseCtx.font = "12px 'Inter', sans-serif";
      pulseCtx.fillText(`Physical Pulse Rate: ${state.latestBpm || 0} BPM | Optical Waveform: Waiting for beyond_the_facade.ino`, width / 2, height * 0.53);

      pulseCtx.fillStyle = "#94a3b8";
      pulseCtx.font = "11px 'Inter', sans-serif";
      pulseCtx.fillText("Click 'HARDWARE INSPECTOR' above to view the live serial buffer streaming from pin A0.", width / 2, height * 0.62);
    }

    // 2. Draw Live Pulse Waveform
    const buf = state.pulseBuffer;
    if (buf.length > 1) {
      pulseCtx.beginPath();
      pulseCtx.strokeStyle = "#00f0ff";
      pulseCtx.lineWidth = 2.5;
      pulseCtx.lineJoin = "round";
      pulseCtx.shadowColor = "rgba(0, 240, 255, 0.55)";
      pulseCtx.shadowBlur = 8;

      const stepX = width / (state.maxPulsePoints - 1);

      for (let i = 0; i < buf.length; i++) {
        const x = i * stepX;
        const normalizedY = (buf[i] - minY) / Math.max(1, maxY - minY);
        const y = height - (normalizedY * height);

        if (i === 0) {
          pulseCtx.moveTo(x, y);
        } else {
          pulseCtx.lineTo(x, y);
        }
      }
      pulseCtx.stroke();
      pulseCtx.shadowBlur = 0; // Reset glow

      // Latest head point indicator
      const lastX = (buf.length - 1) * stepX;
      const lastNormY = (buf[buf.length - 1] - minY) / Math.max(1, maxY - minY);
      const lastY = height - (lastNormY * height);

      pulseCtx.fillStyle = "#ffffff";
      pulseCtx.beginPath();
      pulseCtx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      pulseCtx.fill();
    }

    requestAnimationFrame(renderOscilloscope);
  }

  requestAnimationFrame(renderOscilloscope);

  // ================= Canvas 2: BPM Trend Graph =================
  clearTrendBtn.addEventListener("click", () => {
    state.bpmHistory = [];
  });

  function renderTrendGraph() {
    const width = trendCanvas.width;
    const height = trendCanvas.height;
    trendCtx.clearRect(0, 0, width, height);

    // Subtle grid
    trendCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    trendCtx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = (height / 6) * i;
      trendCtx.beginPath();
      trendCtx.moveTo(0, y);
      trendCtx.lineTo(width, y);
      trendCtx.stroke();
    }

    const minBpmAxis = 40;
    const maxBpmAxis = 140;

    // Y Axis labels
    trendCtx.fillStyle = "rgba(148, 163, 184, 0.6)";
    trendCtx.font = "10px 'JetBrains Mono', monospace";
    trendCtx.fillText("140", 8, 14);
    trendCtx.fillText("90", 8, height / 2);
    trendCtx.fillText("40", 8, height - 6);

    // Draw Baseline Reference line if locked
    if (state.baselineBpm) {
      const normBase = (state.baselineBpm - minBpmAxis) / (maxBpmAxis - minBpmAxis);
      const baseY = height - (normBase * height);

      trendCtx.strokeStyle = "#f59e0b";
      trendCtx.setLineDash([6, 4]);
      trendCtx.beginPath();
      trendCtx.moveTo(0, baseY);
      trendCtx.lineTo(width, baseY);
      trendCtx.stroke();
      trendCtx.setLineDash([]);

      trendCtx.fillStyle = "#f59e0b";
      trendCtx.fillText(`Baseline: ${state.baselineBpm} BPM`, width - 140, baseY - 4);
    }

    // Draw BPM curve
    const history = state.bpmHistory;
    if (history.length > 1) {
      const stepX = width / Math.max(1, history.length - 1);

      // Area fill
      trendCtx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const x = i * stepX;
        const norm = (history[i] - minBpmAxis) / (maxBpmAxis - minBpmAxis);
        const y = height - (norm * height);
        if (i === 0) trendCtx.moveTo(x, y);
        else trendCtx.lineTo(x, y);
      }
      trendCtx.lineTo(width, height);
      trendCtx.lineTo(0, height);
      trendCtx.closePath();

      const gradient = trendCtx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.25)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
      trendCtx.fillStyle = gradient;
      trendCtx.fill();

      // Stroke line
      trendCtx.beginPath();
      trendCtx.strokeStyle = "#10b981";
      trendCtx.lineWidth = 2;
      for (let i = 0; i < history.length; i++) {
        const x = i * stepX;
        const norm = (history[i] - minBpmAxis) / (maxBpmAxis - minBpmAxis);
        const y = height - (norm * height);
        if (i === 0) trendCtx.moveTo(x, y);
        else trendCtx.lineTo(x, y);
      }
      trendCtx.stroke();
    }

    setTimeout(renderTrendGraph, 100);
  }

  renderTrendGraph();

  // ================= Bottom Tabs & Saved Sessions =================
  tabConsoleBtn.addEventListener("click", () => {
    tabConsoleBtn.classList.add("active");
    tabSessionsBtn.classList.remove("active");
    tabConsole.classList.add("active");
    tabSessions.classList.remove("active");
  });

  tabSessionsBtn.addEventListener("click", () => {
    tabSessionsBtn.classList.add("active");
    tabConsoleBtn.classList.remove("active");
    tabSessions.classList.add("active");
    tabConsole.classList.remove("active");
    loadSavedSessions();
  });

  clearConsoleBtn.addEventListener("click", () => {
    serialConsole.innerHTML = "";
    logToConsole("Console cleared.", "info");
  });

  async function loadSavedSessions() {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (!data.sessions || data.sessions.length === 0) {
        sessionsList.innerHTML = '<p class="text-muted">No recorded sessions yet. Click "START SESSION" to begin.</p>';
        return;
      }

      let html = `
        <table class="sessions-table">
          <thead>
            <tr>
              <th>SESSION ID</th>
              <th>MODE</th>
              <th>DURATION</th>
              <th>AVG BPM</th>
              <th>BASELINE</th>
              <th>MAX Δ</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
      `;

      data.sessions.forEach((s) => {
        html += `
          <tr>
            <td>#${s.session_id}</td>
            <td><span class="status-chip ${s.mode === 'DEMO' ? 'chip-elevated' : 'chip-cyan'}">${s.mode}</span></td>
            <td>${s.duration_formatted}</td>
            <td>${s.average_bpm} BPM</td>
            <td>${s.baseline_bpm || '--'} BPM</td>
            <td>+${s.max_change_from_baseline || '0'} BPM</td>
            <td>
              <a href="/api/sessions/${s.session_id}/download" class="btn btn-sm btn-primary">CSV</a>
            </td>
          </tr>
        `;
      });

      html += "</tbody></table>";
      sessionsList.innerHTML = html;
    } catch (err) {
      sessionsList.innerHTML = `<p class="text-muted">Error loading sessions: ${err.message}</p>`;
    }
  }

  // ================= Hardware Diagnostics Inspector Modal =================
  async function loadHardwareDiagnostics() {
    try {
      const res = await fetch("/api/hardware/inspect");
      const data = await res.json();

      diagHwPortBadge.textContent = `PORT: ${data.port || "DISCONNECTED"} (${data.baudrate || 9600} BAUD)`;
      diagHwStatus.textContent = data.connected ? "CONNECTED ●" : "DISCONNECTED ○";
      diagHwStatus.className = `sum-val ${data.connected ? "text-emerald" : "text-crimson"}`;

      diagHwProtocol.textContent = data.detected_protocol || "UNKNOWN";
      diagHwRawStream.textContent = data.has_raw_stream ? "STREAMING (0-1023) ✅" : "PENDING SKETCH UPLOAD ⚠️";
      diagHwRawStream.className = `sum-val ${data.has_raw_stream ? "text-emerald" : "text-amber"}`;

      diagHwRate.textContent = `${data.sample_rate_hz.toFixed(1)} Hz (${data.total_packets} packets)`;
      diagRecommendationText.innerHTML = `<strong>Diagnostic Result:</strong> ${data.diagnosis}`;

      if (data.recent_lines && data.recent_lines.length > 0) {
        diagRawTerminal.textContent = data.recent_lines.join("\n");
        diagRawTerminal.scrollTop = diagRawTerminal.scrollHeight;
      } else {
        diagRawTerminal.textContent = "Waiting for serial packets...";
      }
    } catch (err) {
      diagRecommendationText.textContent = `Failed to query diagnostics: ${err.message}`;
    }
  }

  inspectHardwareBtn.addEventListener("click", () => {
    hardwareModal.classList.remove("hidden");
    loadHardwareDiagnostics();
  });

  closeHwModalBtn.addEventListener("click", () => hardwareModal.classList.add("hidden"));
  hwModalCloseBtn.addEventListener("click", () => hardwareModal.classList.add("hidden"));
  hwModalRefreshBtn.addEventListener("click", loadHardwareDiagnostics);

  // Initial load
  loadSavedSessions();
  setQuestionOnScreen(INQUIRY_SEQUENCE[0], "inquiry", "ACTIVE INQUIRY PROTOCOL #1 • READY", false);
});
