# BEYOND THE FACADE: Arduino Hardware Setup & Guide

## 1. Hardware Overview

* **Microcontroller:** Arduino Uno / Nano / Mega (ATmega328P or compatible)
* **Optical Pulse Sensor:** Standard Pulse Sensor Amped (analog photoplethysmography sensor)
* **Display:** 0.96" I2C Monochrome OLED Display (128x64 pixels, SSD1306 driver, default address `0x3C`)
* **Communication:** USB Serial (Baud Rate: `9600` or `115200`)

---

## 2. Wiring Connections

### Pulse Sensor Wiring:
| Pulse Sensor Pin | Arduino Pin | Notes |
| :--- | :--- | :--- |
| **S (Signal)** | **A0** | Analog input reading PPG waveform |
| **+ (VCC)** | **5V** (or 3.3V) | Power supply |
| **- (GND)** | **GND** | Ground |

### I2C SSD1306 OLED (128x64) Wiring:
| OLED Pin | Arduino Uno / Nano | Arduino Mega |
| :--- | :--- | :--- |
| **VCC** | **5V** (or 3.3V) | 5V |
| **GND** | **GND** | GND |
| **SCL / SCK** | **A5** (or dedicated SCL) | Pin 21 (SCL) |
| **SDA** | **A4** (or dedicated SDA) | Pin 20 (SDA) |

---

## 3. Required Arduino IDE Libraries

In the Arduino IDE, open **Tools -> Manage Libraries...** (or `Ctrl + Shift + I`) and install:
1. **PulseSensor Playground** (by World Famous Electronics llc)
2. **Adafruit SSD1306** (by Adafruit)
3. **Adafruit GFX Library** (by Adafruit)

---

## 4. Flashing the Sketch

1. Connect your Arduino to your laptop via USB.
2. Open `arduino/beyond_the_facade.ino` in Arduino IDE.
3. Select your board from **Tools -> Board** (e.g. *Arduino Uno*).
4. Select your serial COM port from **Tools -> Port** (e.g. *COM3*, *COM5*).
5. Click **Upload** (`Ctrl + U`).

---

## 5. Serial Data Protocol

The sketch streams high-frequency, machine-readable packets formatted as:
```text
<RAW_SIGNAL>,<BPM>\n
```
* **RAW_SIGNAL:** 0–1023 analog ADC photoplethysmogram reading.
* **BPM:** Instantaneous heart rate in beats-per-minute computed by `PulseSensorPlayground` (0 if no finger detected).
* **Streaming Rate:** Non-blocking timer at ~33 Hz (every 30 ms), ensuring smooth real-time waveform rendering on the laptop dashboard without dropping packets.
* **OLED Refresh Rate:** Non-blocking timer at ~5 Hz (every 200 ms), completely eliminating I2C bus stalling.

---

## 6. Important Disclaimer
This hardware-software system is a **college engineering / research prototype**. It is **NOT** a medical diagnostic device and **NOT** a lie detector or deception analysis tool.
