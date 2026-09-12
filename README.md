# BEYOND THE FACADE

## Real-Time Physiological Response Monitoring System

> **Disclaimer:** This is an educational and research prototype. It is **not a medical device, lie detector, or deception-detection system**. The measured values should not be used for medical or psychological conclusions.

---

## 🔹 About the Project

**BEYOND THE FACADE** is a hardware + software system that measures a person's pulse signal and displays it in real time.

The project combines:

* **30% Hardware** – Arduino + Pulse Sensor + OLED
* **70% Software** – Python + Web Dashboard + Data Analysis

The system can show the **live pulse waveform, BPM, changes from a baseline, and recorded data**.

---

## 🔹 How It Works

```text
Pulse Sensor
     ↓
  Arduino
     ↓
 USB Serial
     ↓
 Python Backend
     ↓
 Web Dashboard
     ↓
 Waveform + BPM + Analysis
```

The Arduino reads the pulse sensor and sends the data to the computer.
The Python software receives the data and displays it on a live dashboard.

---

## 🔹 Hardware

* Arduino Uno/Nano
* Optical Pulse Sensor
* SSD1306 128×64 OLED
* USB Cable

The pulse sensor is connected to **A0** and the OLED uses **I²C**.

---

## 🔹 Main Features

### 1. Live Pulse Waveform

The website displays the pulse signal as a real-time graph, similar to a basic oscilloscope.

**Screenshot 1 – Live Dashboard**

📷 *Insert screenshot here*

---

### 2. Live BPM

The current heart rate is displayed clearly on the dashboard.

Example:

```text
BPM
78
```

The OLED can also display the BPM locally.

---

### 3. Baseline Comparison

When a session starts, the system records an initial baseline.

It then compares the current BPM with the baseline:

```text
Baseline BPM
Current BPM
Δ BPM
% Change
```

This demonstrates how physiological changes can be monitored over time.

---

### 4. Session Recording

The user can:

```text
START
   ↓
MONITOR
   ↓
PAUSE / RESUME
   ↓
END
```

The collected data can be saved as a **CSV file** for further analysis.

---

### 5. Demo Mode

The project also includes a simulated pulse waveform.

This allows the software to be demonstrated even when the physical sensor is not connected.

A clear message is shown:

```text
DEMO MODE — SIMULATED DATA
```

---

## 🔹 Project Screenshots

### Screenshot 1 — Dashboard
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f973a9d0-ddf9-4b6b-b7b1-3df940329958" />

📷 *Insert screenshot of the main website*

### Screenshot 2 — Hardware
<img width="720" height="1600" alt="image" src="https://github.com/user-attachments/assets/827592e2-4925-4681-8b51-cc32ab1c79eb" />

📷 *Insert screenshot of Arduino + Pulse Sensor + OLED*



---

## 🎥 Live Demo

**Watch the complete demonstration:**
https://drive.google.com/file/d/1qXf5A1oV0NOyWTrxfwafUFV1CPnIQDpB/view?usp=drivesdk
🔗 **[INSERT LIVE DEMO VIDEO LINK]**

The video demonstrates:

1. Hardware setup
2. Pulse sensing
3. Arduino data transmission
4. Live waveform
5. BPM display
6. Baseline monitoring
7. Session recording
8. Data export

---

## 🔹 Software

The project uses:

* **Arduino IDE** – Arduino programming
* **Python** – Backend and data processing
* **FastAPI** – Web server
* **WebSockets** – Real-time communication
* **PySerial** – Arduino serial communication
* **HTML/CSS/JavaScript** – Dashboard
* **HTML5 Canvas** – Live waveform

---

## 🔹 Running the Project

Install the required Python packages:

```powershell
pip install -r requirements.txt
```

Start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://127.0.0.1:8000
```

Connect the Arduino and select its **COM port**.

---

## 🔹 Data Output

Recorded sessions can be exported as CSV files containing:

```text
Timestamp
Elapsed Time
Raw Pulse Signal
BPM
Mode
```

This data can later be analysed using Excel, Python, MATLAB, or other software.

---

## 🔹 Future Scope

The system can later be expanded with:

* Better signal filtering
* Motion-artifact detection
* HRV analysis
* Multiple sensors
* ESP32 wireless communication
* Advanced signal processing
* Machine-learning experiments

---

## 🔹 Conclusion

**BEYOND THE FACADE** demonstrates a complete sensor-to-software pipeline:

**Sense → Process → Visualize → Analyse → Record**

It combines a simple physiological sensor with a modern software dashboard to create an affordable real-time monitoring prototype.
