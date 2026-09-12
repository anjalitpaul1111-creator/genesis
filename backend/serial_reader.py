"""
BEYOND THE FACADE - USB Serial Reader
Manages dynamic COM port enumeration, background serial reading thread,
robust packet parsing (<RAW>,<BPM>), reconnect handling, and throughput measurement.
"""

import time
import threading
import collections
from typing import Optional, Callable, List, Dict, Any

try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False


def list_available_ports() -> List[Dict[str, Any]]:
    """Scan and list all available system COM ports with hardware descriptions."""
    if not SERIAL_AVAILABLE:
        return []
        
    ports = []
    for port in serial.tools.list_ports.comports():
        desc = port.description or "Unknown Serial Device"
        hwid = port.hwid or ""
        # Check if device is commonly associated with microcontrollers
        is_mcu = any(token in (desc + hwid).lower() for token in [
            "arduino", "ch340", "cp210", "ftdi", "usb serial", "usb-serial", "cdc", "teensy", "esp32"
        ])
        ports.append({
            "port": port.device,
            "description": desc,
            "hwid": hwid,
            "is_recommended": is_mcu
        })
        
    # Sort recommended ports to the top
    ports.sort(key=lambda x: (not x["is_recommended"], x["port"]))
    return ports


class SerialReader:
    def __init__(self):
        self.serial_port: Optional[serial.Serial] = None
        self.port_name: Optional[str] = None
        self.baudrate: int = 9600
        
        self.is_connected: bool = False
        self.status_message: str = "Disconnected"
        
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Callback list for incoming packets: fn(raw: int, bpm: int)
        self._callbacks: List[Callable[[int, int], None]] = []
        
        # Throughput & statistics
        self._sample_timestamps = collections.deque(maxlen=100)
        self.current_sample_rate_hz: float = 0.0
        self.total_packets_received: int = 0
        self.error_count: int = 0
        self.last_raw_value: int = 512
        self.last_bpm_value: int = 0
        self.last_valid_bpm: int = 0
        self.last_valid_time: float = 0.0
        self.candidate_bpm: Optional[int] = None
        self.candidate_count: int = 0
        self.last_raw_sensor_bpm: int = 0
        self.harmonic_candidate_bpm: Optional[int] = None
        self.is_valid_bpm: bool = False
        self.signal_quality: str = "NO_SIGNAL"
        self.artifact_reason: str = ""
        self.last_raw_line: str = ""
        self.last_packet_time: float = 0.0
        self.detected_protocol: str = "UNKNOWN"
        self.recent_raw_lines: collections.deque = collections.deque(maxlen=20)

    def register_callback(self, callback: Callable[[int, int], None]):
        """Register a callback for new valid data points."""
        self._callbacks.append(callback)

    def connect(self, port: str, baudrate: int = 9600) -> Dict[str, Any]:
        """Connect to specified COM port."""
        if not SERIAL_AVAILABLE:
            self.status_message = "pyserial library is not installed"
            return {"success": False, "error": self.status_message}

        self.disconnect()
        
        try:
            self.port_name = port
            self.baudrate = baudrate
            self.status_message = f"Connecting to {port} at {baudrate} baud..."
            
            self.serial_port = serial.Serial(
                port=port,
                baudrate=baudrate,
                timeout=0.5,
                write_timeout=0.5
            )
            
            # Flush existing buffer
            self.serial_port.reset_input_buffer()
            
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._read_loop, daemon=True)
            self._thread.start()
            
            self.is_connected = True
            self.status_message = f"Connected to {port} ({baudrate} baud)"
            return {"success": True, "port": port, "baudrate": baudrate}
            
        except serial.SerialException as e:
            self.is_connected = False
            err_msg = str(e)
            if "Access is denied" in err_msg or "PermissionError" in err_msg:
                err_msg = f"{port} is currently locked by another program (e.g. Arduino IDE Serial Monitor/Plotter). Please close the Serial Monitor/Plotter window in Arduino IDE and click CONNECT again."
            self.status_message = f"Serial error: {err_msg}"
            return {"success": False, "error": err_msg}
        except Exception as ex:
            self.is_connected = False
            self.status_message = f"Failed to connect: {str(ex)}"
            return {"success": False, "error": str(ex)}

    def disconnect(self):
        """Cleanly disconnect from serial port."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
        self._thread = None
        
        if self.serial_port:
            try:
                if self.serial_port.is_open:
                    self.serial_port.close()
            except Exception:
                pass
            self.serial_port = None
            
        self.is_connected = False
        self.status_message = "Disconnected"

    def write_command(self, cmd: str) -> bool:
        """Send command string to Arduino over USB Serial."""
        if self.serial_port and self.serial_port.is_open:
            try:
                line = (cmd.strip() + "\n").encode('utf-8')
                self.serial_port.write(line)
                self.serial_port.flush()
                return True
            except Exception as e:
                print(f"[SERIAL] Command send error: {e}")
        return False

    def _read_loop(self):
        """Worker thread continuously reading from serial port."""
        consecutive_errors = 0
        
        while not self._stop_event.is_set() and self.serial_port and self.serial_port.is_open:
            try:
                line_bytes = self.serial_port.readline()
                if not line_bytes:
                    continue
                    
                line_str = line_bytes.decode('utf-8', errors='ignore').strip()
                if not line_str:
                    continue
                    
                raw_val, bpm_val = self._parse_line(line_str)
                if raw_val is not None:
                    consecutive_errors = 0
                    self.total_packets_received += 1
                    self.last_raw_value = raw_val
                    if bpm_val is not None and bpm_val > 0:
                        self.last_bpm_value = bpm_val
                    
                    # Update rolling sample rate
                    now = time.time()
                    self._sample_timestamps.append(now)
                    if len(self._sample_timestamps) > 1:
                        dt = self._sample_timestamps[-1] - self._sample_timestamps[0]
                        if dt > 0:
                            self.current_sample_rate_hz = round((len(self._sample_timestamps) - 1) / dt, 1)

                    # Notify callbacks
                    effective_bpm = bpm_val if bpm_val is not None else self.last_bpm_value
                    for cb in self._callbacks:
                        try:
                            cb(raw_val, effective_bpm)
                        except Exception as cb_err:
                            print(f"Callback error: {cb_err}")

            except (serial.SerialException, OSError) as e:
                self.error_count += 1
                consecutive_errors += 1
                if consecutive_errors > 5:
                    self.status_message = f"Hardware disconnected or port error: {e}"
                    self.is_connected = False
                    break
                time.sleep(0.05)
            except Exception as e:
                self.error_count += 1
                time.sleep(0.02)
                
        self.is_connected = False

    def _parse_line(self, line: str):
        """
        Parses incoming serial line.
        Supports standard protocol: '<raw>,<bpm>' (e.g. '534,78')
        Also supports fallback legacy format: 'BPM: 78' or single integer '534'
        """
        self.last_raw_line = line
        self.recent_raw_lines.append(line)
        self.last_packet_time = time.time()
        
        try:
            if ',' in line:
                parts = line.split(',')
                raw_val = int(float(parts[0].strip()))
                bpm_val = int(float(parts[1].strip())) if len(parts) > 1 and parts[1].strip() else self.last_bpm_value
                # Sanity clamp
                raw_val = max(0, min(1023, raw_val))
                bpm_val = max(0, min(240, bpm_val))
                self.detected_protocol = "UPGRADED_RAW_AND_BPM"
            elif line.startswith("BPM:"):
                bpm_val = int(float(line.replace("BPM:", "").strip()))
                bpm_val = max(0, min(240, bpm_val))
                self.detected_protocol = "LEGACY_BPM_ONLY"
                raw_val = self.last_raw_value
            elif line.isdigit():
                raw_val = max(0, min(1023, int(line)))
                bpm_val = self.last_bpm_value
                self.detected_protocol = "RAW_ONLY"
            else:
                return None, None

            # Physiological filter: Human resting heart rate is strictly 45 to 145 BPM
            if bpm_val is not None:
                self.last_raw_sensor_bpm = bpm_val
                now_t = time.time()
                time_since_valid = now_t - self.last_valid_time if self.last_valid_time > 0 else 999.0

                if 45 <= bpm_val <= 145:
                    # Case 1: Fresh acquisition or time gap > 2.5s -> Accept immediately
                    if self.last_valid_bpm == 0 or time_since_valid > 2.5:
                        self.is_valid_bpm = True
                        self.last_valid_bpm = bpm_val
                        self.last_bpm_value = bpm_val
                        self.last_valid_time = now_t
                        self.candidate_bpm = None
                        self.candidate_count = 0
                        self.signal_quality = "VALID"
                        self.artifact_reason = ""
                        self.harmonic_candidate_bpm = None
                    # Case 2: Smooth physiological transition (delta <= 35 BPM) -> Accept immediately
                    elif abs(bpm_val - self.last_valid_bpm) <= 35:
                        self.is_valid_bpm = True
                        self.last_valid_bpm = bpm_val
                        self.last_bpm_value = bpm_val
                        self.last_valid_time = now_t
                        self.candidate_bpm = None
                        self.candidate_count = 0
                        self.signal_quality = "VALID"
                        self.artifact_reason = ""
                        self.harmonic_candidate_bpm = None
                    # Case 3: Rate change (e.g. 144 -> 51) -> Verify with 1 consecutive repeat, then accept!
                    else:
                        if self.candidate_bpm is not None and abs(bpm_val - self.candidate_bpm) <= 12:
                            # Confirmed by consecutive beat! Accept new true rate
                            self.is_valid_bpm = True
                            self.last_valid_bpm = bpm_val
                            self.last_bpm_value = bpm_val
                            self.last_valid_time = now_t
                            self.candidate_bpm = None
                            self.candidate_count = 0
                            self.signal_quality = "VALID"
                            self.artifact_reason = ""
                            self.harmonic_candidate_bpm = None
                        else:
                            self.candidate_bpm = bpm_val
                            self.candidate_count = 1
                            self.is_valid_bpm = False
                            self.signal_quality = "VERIFYING_RATE"
                            self.artifact_reason = f"Verifying rate change ({self.last_valid_bpm} -> {bpm_val} BPM)..."
                elif bpm_val == 0:
                    self.is_valid_bpm = False
                    self.harmonic_candidate_bpm = None
                    if 200 < raw_val < 950:
                        self.signal_quality = "ACQUIRING"
                        self.artifact_reason = "Finger detected. Locking onto pulse wave..."
                    else:
                        self.signal_quality = "NO_FINGER"
                        self.artifact_reason = "Place finger lightly on optical sensor"
                    if now_t - self.last_valid_time > 3.5:
                        self.last_valid_bpm = 0
                        self.last_bpm_value = 0
                else:
                    self.is_valid_bpm = False
                    self.signal_quality = "ARTIFACT_NOISE"
                    if bpm_val > 145:
                        half_bpm = round(bpm_val / 2)
                        if 48 <= half_bpm <= 100:
                            self.harmonic_candidate_bpm = half_bpm
                            self.artifact_reason = f"Optical double-trigger ({bpm_val} BPM rejected; estimated fundamental ~{half_bpm} BPM)"
                        else:
                            self.harmonic_candidate_bpm = None
                            self.artifact_reason = f"Optical noise artifact rejected ({bpm_val} BPM > 145 max resting)"
                    else:
                        self.harmonic_candidate_bpm = None
                        self.artifact_reason = f"Low pulse artifact rejected ({bpm_val} BPM < 45 min resting)"

            return raw_val, bpm_val
        except (ValueError, TypeError):
            self.error_count += 1
            return None, None
            
        return None, None
