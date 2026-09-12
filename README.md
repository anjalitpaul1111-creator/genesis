# BEYOND THE FACADE
### Real-Time Physiological Response Monitoring System

> **ACADEMIC & RESEARCH DISCLAIMER:**
> This software and hardware prototype is created for educational, engineering, and research demonstration.
> It is **NOT** a medical diagnostic instrument and **NOT** a lie detector or deception analysis system.
> Do not make clinical, medical, or veracity claims based on these measurements.

---

## 1. Project Overview

**“BEYOND THE FACADE”** is a complete, hybrid hardware-software engineering system designed to acquire, process, visualize, and analyze physiological pulse waves (Photoplethysmogram / PPG) and heart rate dynamics in real-time.

* **30% Hardware:** Arduino Uno/Nano + Optical Pulse Sensor (A0) + SSD1306 128×64 I2C OLED display (0x3C).
* **70% Software:** Real-time Python telemetry server (FastAPI + WebSockets + pyserial), high-performance HTML5 Canvas Serial Plotter oscilloscope, baseline variance engine, session recorder, and CSV exporter.

---

## 2. Project Architecture

```text
beyond_the_facade/
├── arduino/
│   ├── beyond_the_facade.ino    # Arduino firmware with non-blocking serial stream and OLED
│   └── README_ARDUINO.md        # Hardware wiring diagram and flashing guide
├── backend/
│   ├── server.py                # FastAPI app, static file server, and WebSocket broadcaster
│   ├── serial_reader.py         # PySerial background thread, auto port scanner, packet parser
│   ├── demo_simulator.py        # Realistic PPG pulse waveform generator (Demo Mode)
│   └── data_logger.py           # Session lifecycle manager, baseline calculator, and CSV logger
├── frontend/
│   ├── index.html               # Engineering dashboard structure and telemetry layouts
│   ├── style.css                # Dark-mode oscilloscope styling and responsive grid
│   └── app.js                   # WebSocket handler, Canvas 60 FPS oscilloscope, session UX
├── data/
│   └── sessions/                # Output directory for recorded session CSVs and summaries
├── requirements.txt             # Python dependencies
└── README.md                    # This documentation file
```

---

## 3. Communication Protocol

The Arduino sketch transmits machine-readable packets formatted as:
```text
<RAW_SIGNAL>,<BPM>\n
```
* **RAW_SIGNAL:** 0–1023 analog ADC reading from Pulse Sensor on pin `A0`.
* **BPM:** Instantaneous heart rate computed by `PulseSensorPlayground`.
* **Streaming Rate:** ~33 Hz (interval: 30 ms) using non-blocking `millis()`.
* **OLED Refresh Rate:** ~5 Hz (interval: 200 ms) to prevent I2C bus stalling.

---

## 4. Key Features

1. **Live Serial Plotter Oscilloscope:**
   - 60 FPS HTML5 Canvas rendering of the raw pulse waveform.
   - Dual scaling modes: Centered dynamic auto-scaling and full 0–1023 ADC range.
   - Optical threshold reference line at 550.
   - Pause, resume, and clear controls.

2. **Live Heart Rate Telemetry:**
   - Giant central digital BPM readout.
   - Beat-synchronized pulsing heart icon.
   - Physiological status chip (`RESTING`, `ELEVATED`, `HIGHER RESPONSE`).

3. **Baseline Analysis Engine:**
   - "START SESSION" automatically acquires an initial 15-second baseline period.
   - Real-time computing of Current BPM, Absolute Delta (Δ), and Percentage Response Change (+%).

4. **Session Recording & CSV Export:**
   - Start, pause, resume, and end session controls with high-precision stopwatch timer.
   - Generates comprehensive session summary (Avg, Min, Max, Baseline, Max Change, Duration).
   - Direct export to standardized CSV files containing `timestamp_iso, elapsed_seconds, raw_signal, bpm, mode`.

5. **Demo Mode (Presentation Mode):**
   - High-fidelity physiological PPG simulation with realistic systolic peak, dicrotic notch, diastolic wave, baseline respiratory wander, and heart rate variability (HRV).
   - High-visibility banner `DEMO MODE — SIMULATED DATA` prevents confusion with live hardware.

---

## 5. Running the Application

### 1. Prerequisites
- Python 3.10+ (installed automatically in `.venv`).

### 2. Launching the Backend Server
In PowerShell:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

### 3. Accessing the Dashboard
Open your web browser and navigate to:
```text
http://127.0.0.1:8000
```

### 4. Flashing the Arduino
1. Open `arduino/beyond_the_facade.ino` in Arduino IDE.
2. Ensure `PulseSensor Playground` and `Adafruit SSD1306` libraries are installed.
3. Upload to your Arduino.
4. On the web dashboard, select your Arduino's COM port from the dropdown and click **CONNECT**.
