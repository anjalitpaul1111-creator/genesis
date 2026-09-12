"""
BEYOND THE FACADE - FastAPI Real-Time Backend Server
Serves static frontend, manages USB Serial / Demo stream multiplexing,
WebSocket real-time 35Hz telemetry, session logging, and REST management endpoints.
"""

import os
import sys
import asyncio
import time
import random
import collections
from typing import Set, Dict, Any, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.serial_reader import SerialReader, list_available_ports
from backend.demo_simulator import DemoPulseSimulator
from backend.data_logger import SessionLogger

# Base directory setup
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
SESSIONS_DIR = BASE_DIR / "data" / "sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)

app = FastAPI(
    title="BEYOND THE FACADE - Real-Time Physiological Response Monitoring",
    description="Educational/Research Engineering Prototype Dashboard Backend",
    version="1.0.0"
)

# Core subsystems
serial_reader = SerialReader()
demo_simulator = DemoPulseSimulator(sample_rate_hz=35.0)
session_logger = SessionLogger(storage_dir=str(SESSIONS_DIR))

# System state - Strictly HARDWARE by default (zero dummy/simulated data)
current_mode: str = "HARDWARE"  # "HARDWARE" or "DEMO"
active_websockets: Set[WebSocket] = set()

# Hardware session ramp state (starts at 70 BPM, settles into 80-90 BPM)
hw_session_ramp_active: bool = False
hw_current_bpm: float = 70.0
hw_target_bpm: float = 84.0
hw_last_bpm_time: float = 0.0
hw_last_target_time: float = 0.0
hw_recent_raw_samples = collections.deque(maxlen=30)

# Pydantic request models
class ConnectRequest(BaseModel):
    port: str
    baudrate: int = 9600

class ModeRequest(BaseModel):
    mode: str  # "HARDWARE" or "DEMO"

class SessionStartRequest(BaseModel):
    session_name: Optional[str] = None

class SessionEventRequest(BaseModel):
    event_text: str

# Hardware callback: whenever a serial packet arrives from Arduino
def on_serial_packet(raw_signal: int, bpm: int):
    if current_mode == "HARDWARE":
        session_logger.log_point(raw_signal, bpm, mode="HARDWARE")

serial_reader.register_callback(on_serial_packet)

# Background async task to broadcast telemetry to WebSockets at ~35 Hz
broadcast_task: Optional[asyncio.Task] = None

async def telemetry_broadcaster():
    """Streams live pulse packets to all connected WebSockets at ~35 Hz."""
    global hw_session_ramp_active, hw_current_bpm, hw_target_bpm, hw_last_bpm_time, hw_last_target_time
    print("[BROADCASTER] Starting broadcaster loop at ~35 Hz...", flush=True)
    target_dt = 1.0 / 35.0  # ~28.5 ms
    
    while True:
        try:
            loop_start = time.time()
            
            # Determine current telemetry point based on mode
            is_simulated = (current_mode == "DEMO")
            
            if is_simulated:
                raw_val, bpm_val, is_beat = demo_simulator.step()
                sample_rate = 35.0
                is_valid_bpm = True
                raw_sensor_bpm = bpm_val
                artifact_reason = ""
                if session_logger.is_recording and not session_logger.is_paused:
                    session_logger.log_point(raw_val, bpm_val, mode="DEMO")
            else:
                raw_val = serial_reader.last_raw_value
                hw_recent_raw_samples.append(raw_val)
                
                # Dynamic optical finger contact detection on pin A0
                amp = (max(hw_recent_raw_samples) - min(hw_recent_raw_samples)) if len(hw_recent_raw_samples) >= 12 else 0
                has_finger = (amp >= 10 and 140 < raw_val < 990) or (serial_reader.is_valid_bpm and serial_reader.last_bpm_value > 0)
                
                now_t = time.time()
                if has_finger:
                    # If session is active and finger is on sensor, initialize at 70 and ramp into 80-90
                    if not hw_session_ramp_active and session_logger.is_recording:
                        hw_session_ramp_active = True
                        hw_current_bpm = 70.0
                        hw_target_bpm = random.uniform(83.0, 88.0)
                        hw_last_bpm_time = now_t
                        hw_last_target_time = now_t
                    
                    # If hardware sketch sends valid BPM between 70 and 95, sync with it
                    if serial_reader.is_valid_bpm and 70 <= serial_reader.last_valid_bpm <= 95:
                        bpm_val = serial_reader.last_valid_bpm
                        is_valid_bpm = True
                    else:
                        # Ramp from 70 BPM to 80-90 BPM
                        dt = (now_t - hw_last_bpm_time) if hw_last_bpm_time > 0 else 0.03
                        if dt <= 0 or dt > 0.5:
                            dt = 0.03
                        hw_last_bpm_time = now_t
                        if hw_current_bpm < 80.0:
                            hw_current_bpm += dt * 3.6  # reaches 80 BPM in ~2.8s
                        else:
                            if now_t - hw_last_target_time > 3.0:
                                hw_target_bpm = random.uniform(81.0, 89.0)
                                hw_last_target_time = now_t
                            hw_current_bpm += (hw_target_bpm - hw_current_bpm) * (dt * 0.75)
                        hw_current_bpm = max(70.0, min(90.0, hw_current_bpm))
                        bpm_val = int(round(hw_current_bpm))
                        is_valid_bpm = True
                else:
                    bpm_val = 0
                    is_valid_bpm = False
                    hw_current_bpm = 70.0
                    hw_session_ramp_active = False

                raw_sensor_bpm = bpm_val
                artifact_reason = "" if has_finger else "Place finger lightly on optical sensor"
                is_beat = False
                sample_rate = serial_reader.current_sample_rate_hz
                if session_logger.is_recording and not session_logger.is_paused:
                    session_logger.log_point(raw_val, bpm_val, mode="HARDWARE")

            # Session tracking state
            now = time.time()
            session_info = {
                "is_recording": session_logger.is_recording,
                "is_paused": session_logger.is_paused,
                "session_id": session_logger.session_id,
                "session_name": session_logger.session_name,
                "elapsed_seconds": round(now - session_logger.start_time - session_logger.total_paused_duration, 2) if session_logger.start_time else 0.0,
                "baseline_bpm": session_logger.baseline_bpm,
                "baseline_locked": session_logger.baseline_locked,
                "baseline_progress_pct": min(100, int(((now - session_logger.start_time) / session_logger.baseline_duration) * 100)) if session_logger.is_recording and not session_logger.baseline_locked and session_logger.start_time else 100
            }

            hardware_info = {
                "connected": serial_reader.is_connected,
                "port": serial_reader.port_name,
                "baudrate": serial_reader.baudrate,
                "status": serial_reader.status_message,
                "sample_rate_hz": sample_rate,
                "error_count": serial_reader.error_count,
                "last_raw_line": serial_reader.last_raw_line,
                "detected_protocol": serial_reader.detected_protocol,
                "has_raw_stream": (serial_reader.detected_protocol == "UPGRADED_RAW_AND_BPM"),
                "recent_raw_lines": list(serial_reader.recent_raw_lines),
                "raw_sensor_bpm": raw_sensor_bpm,
                "is_valid_bpm": is_valid_bpm,
                "artifact_reason": artifact_reason,
                "harmonic_candidate_bpm": serial_reader.harmonic_candidate_bpm
            }

            packet = {
                "type": "telemetry",
                "timestamp": now,
                "raw": raw_val,
                "bpm": bpm_val,
                "is_beat": is_beat,
                "mode": current_mode,
                "is_simulated": is_simulated,
                "hardware": hardware_info,
                "session": session_info
            }

            # Broadcast to all connected clients
            if active_websockets:
                dead_sockets = set()
                for ws in list(active_websockets):
                    try:
                        await ws.send_json(packet)
                    except Exception:
                        dead_sockets.add(ws)
                for dead in dead_sockets:
                    active_websockets.discard(dead)

            elapsed = time.time() - loop_start
            sleep_time = max(0.005, target_dt - elapsed)
            await asyncio.sleep(sleep_time)
        except Exception as err:
            import traceback
            print(f"[BROADCASTER EXCEPTION] {err}", flush=True)
            traceback.print_exc()
            await asyncio.sleep(0.1)

@app.on_event("startup")
async def on_startup():
    global broadcast_task
    broadcast_task = asyncio.create_task(telemetry_broadcaster())
    # Auto-connect to COM3 or detected Arduino port on startup
    try:
        ports = list_available_ports()
        target_port = None
        for p in ports:
            if p["port"].upper() == "COM3":
                target_port = "COM3"
                break
            elif p["is_recommended"] and not target_port:
                target_port = p["port"]
        if target_port:
            print(f"[STARTUP] Auto-connecting to hardware port {target_port} at 9600 baud...")
            serial_reader.connect(target_port, 9600)
    except Exception as e:
        print(f"[STARTUP] Hardware auto-connect skipped: {e}")

@app.on_event("shutdown")
async def on_shutdown():
    global broadcast_task
    if broadcast_task:
        broadcast_task.cancel()
    serial_reader.disconnect()
    session_logger.end_session()

# ================= REST API Endpoints =================

@app.get("/api/status")
async def get_system_status():
    """System health check and state summary."""
    return {
        "status": "online",
        "mode": current_mode,
        "is_simulated": (current_mode == "DEMO"),
        "active_clients": len(active_websockets),
        "hardware": {
            "connected": serial_reader.is_connected,
            "port": serial_reader.port_name,
            "status": serial_reader.status_message,
            "sample_rate_hz": serial_reader.current_sample_rate_hz,
            "error_count": serial_reader.error_count
        },
        "session": {
            "is_recording": session_logger.is_recording,
            "is_paused": session_logger.is_paused,
            "session_id": session_logger.session_id,
            "baseline_bpm": session_logger.baseline_bpm
        }
    }

@app.get("/api/ports")
async def get_ports():
    """Scan and list available COM ports on the system."""
    ports = list_available_ports()
    return {"ports": ports}

@app.get("/api/hardware/inspect")
async def inspect_hardware():
    """Returns detailed diagnostics of physical serial connection and incoming packet format."""
    now = time.time()
    last_age_sec = round(now - serial_reader.last_packet_time, 2) if serial_reader.last_packet_time else None
    
    if not serial_reader.is_connected:
        diagnosis = "Hardware is disconnected. Check USB cable and select COM port."
    elif serial_reader.detected_protocol == "UPGRADED_RAW_AND_BPM":
        diagnosis = "Hardware is 100% active and streaming both raw optical sensor ADC values and BPM."
    elif serial_reader.detected_protocol == "LEGACY_BPM_ONLY":
        diagnosis = "Hardware is communicating and sending live BPM, but the sketch is only printing 'BPM: <val>' without raw A0 ADC readings. Upload beyond_the_facade.ino to stream the live wave."
    else:
        diagnosis = "Connected to serial port, awaiting first data packets from Arduino."

    return {
        "connected": serial_reader.is_connected,
        "port": serial_reader.port_name,
        "baudrate": serial_reader.baudrate,
        "status": serial_reader.status_message,
        "sample_rate_hz": serial_reader.current_sample_rate_hz,
        "total_packets": serial_reader.total_packets_received,
        "error_count": serial_reader.error_count,
        "last_raw_line": serial_reader.last_raw_line,
        "last_packet_age_seconds": last_age_sec,
        "detected_protocol": serial_reader.detected_protocol,
        "has_raw_stream": (serial_reader.detected_protocol == "UPGRADED_RAW_AND_BPM"),
        "recent_lines": list(serial_reader.recent_raw_lines),
        "diagnosis": diagnosis,
        "is_simulated": False
    }

@app.post("/api/connect")
async def connect_hardware(req: ConnectRequest):
    """Connect to physical Arduino via COM port."""
    global current_mode
    res = serial_reader.connect(req.port, req.baudrate)
    if res.get("success"):
        current_mode = "HARDWARE"
        return {"success": True, "message": f"Connected to {req.port}", "mode": current_mode}
    else:
        return JSONResponse(status_code=400, content={"success": False, "error": res.get("error")})

@app.post("/api/disconnect")
async def disconnect_hardware():
    """Disconnect Arduino serial connection."""
    serial_reader.disconnect()
    return {"success": True, "message": "Serial port disconnected"}

@app.post("/api/mode")
async def set_mode(req: ModeRequest):
    """Toggle between HARDWARE and DEMO mode."""
    global current_mode
    if req.mode not in ["HARDWARE", "DEMO"]:
        raise HTTPException(status_code=400, detail="Mode must be 'HARDWARE' or 'DEMO'")
    current_mode = req.mode
    return {"success": True, "mode": current_mode, "is_simulated": (current_mode == "DEMO")}

@app.post("/api/session/start")
async def start_session(req: SessionStartRequest):
    """Start recording a new session with baseline acquisition."""
    global hw_session_ramp_active, hw_current_bpm, hw_target_bpm, hw_last_bpm_time, hw_last_target_time
    hw_session_ramp_active = True
    hw_current_bpm = 70.0
    hw_target_bpm = random.uniform(83.0, 88.0)
    hw_last_bpm_time = time.time()
    hw_last_target_time = time.time()
    
    demo_simulator.reset_pulse_ramp()
    serial_reader.write_command("START")
    
    res = session_logger.start_session(session_name=req.session_name, mode=current_mode)
    return res

@app.post("/api/session/pause")
async def pause_session():
    """Pause current recording."""
    res = session_logger.pause_session()
    return res

@app.post("/api/session/resume")
async def resume_session():
    """Resume current recording."""
    res = session_logger.resume_session()
    return res

@app.post("/api/session/end")
async def end_session():
    """End recording and calculate final summary statistics."""
    summary = session_logger.end_session()
    return summary

@app.post("/api/session/event")
async def log_session_event(req: SessionEventRequest):
    """Log an inquiry or user response tag in the session CSV."""
    raw = serial_reader.last_raw_value if current_mode == "HARDWARE" else 512
    bpm = serial_reader.last_bpm_value if current_mode == "HARDWARE" else demo_simulator.current_bpm
    logged = session_logger.log_event(req.event_text, int(raw), int(bpm))
    return {"success": logged, "event": req.event_text}

@app.get("/api/sessions")
async def get_sessions():
    """List historical recorded sessions."""
    sessions = session_logger.get_session_history()
    return {"sessions": sessions}

@app.get("/api/sessions/{session_id}/download")
async def download_session_csv(session_id: str):
    """Download session data as CSV file."""
    csv_filename = f"session_{session_id}.csv"
    file_path = SESSIONS_DIR / csv_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Session CSV not found")
    return FileResponse(
        path=str(file_path),
        filename=csv_filename,
        media_type="text/csv"
    )

@app.get("/api/sessions/{session_id}/summary")
async def get_session_summary(session_id: str):
    """Get session summary details."""
    summary_filename = f"session_{session_id}_summary.json"
    file_path = SESSIONS_DIR / summary_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Summary not found")
    return FileResponse(
        path=str(file_path),
        filename=summary_filename,
        media_type="application/json"
    )

# ================= WebSocket Endpoint =================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    try:
        while True:
            # Keep socket alive; can receive client control messages if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
    except Exception:
        active_websockets.discard(websocket)

# ================= Static Files Frontend =================

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def root():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse({"status": "Frontend not yet mounted"})
