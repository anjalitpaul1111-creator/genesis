"""
BEYOND THE FACADE - Session Data Logger
Handles session recording, real-time statistics, CSV storage, and session export.
"""

import os
import csv
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any, List

class SessionLogger:
    def __init__(self, storage_dir: str = "data/sessions"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # Session state
        self.is_recording = False
        self.is_paused = False
        self.session_id: Optional[str] = None
        self.session_name: Optional[str] = None
        self.start_time: Optional[float] = None
        self.pause_start_time: Optional[float] = None
        self.total_paused_duration: float = 0.0
        
        # Baseline tracking
        self.baseline_duration = 15.0  # initial 15 seconds used for baseline calculation
        self.baseline_samples: List[float] = []
        self.baseline_bpm: Optional[float] = None
        self.baseline_locked = False
        
        # Statistics
        self.bpm_samples: List[int] = []
        self.raw_samples: List[int] = []
        self.max_delta_bpm: float = 0.0
        self.mode_label = "HARDWARE"
        
        # File handles
        self.csv_filepath: Optional[str] = None
        self.csv_file = None
        self.csv_writer = None

    def start_session(self, session_name: Optional[str] = None, mode: str = "HARDWARE") -> Dict[str, Any]:
        """Start a new recording session."""
        now = datetime.now()
        self.session_id = now.strftime("%Y%m%d_%H%M%S")
        self.session_name = session_name or f"Session_{self.session_id}"
        self.mode_label = mode
        
        self.is_recording = True
        self.is_paused = False
        self.start_time = time.time()
        self.pause_start_time = None
        self.total_paused_duration = 0.0
        
        self.baseline_samples = []
        self.baseline_bpm = None
        self.baseline_locked = False
        
        self.bpm_samples = []
        self.raw_samples = []
        self.max_delta_bpm = 0.0
        
        # Setup CSV file
        filename = f"session_{self.session_id}.csv"
        self.csv_filepath = os.path.join(self.storage_dir, filename)
        
        self.csv_file = open(self.csv_filepath, mode='w', newline='', encoding='utf-8')
        self.csv_writer = csv.writer(self.csv_file)
        
        # Write CSV Header with non-diagnostic disclaimer in comment
        self.csv_file.write("# PROJECT: BEYOND THE FACADE - Physiological Response Monitoring Prototype\n")
        self.csv_file.write("# DISCLAIMER: Educational/Research Prototype Only. Not a medical diagnostic device or lie detector.\n")
        self.csv_writer.writerow(["timestamp_iso", "elapsed_seconds", "raw_signal", "bpm", "mode", "event"])
        self.csv_file.flush()
        
        return {
            "status": "started",
            "session_id": self.session_id,
            "session_name": self.session_name,
            "filepath": self.csv_filepath,
            "start_time_iso": now.isoformat()
        }

    def log_event(self, event_text: str, raw_signal: Optional[int] = None, bpm: Optional[int] = None) -> bool:
        """Annotates an inquiry question or user response directly in the session CSV."""
        if not self.is_recording or not self.csv_file:
            return False
            
        now = time.time()
        elapsed = now - self.start_time - self.total_paused_duration
        timestamp_iso = datetime.now().isoformat()
        raw_val = raw_signal if raw_signal is not None else (self.raw_samples[-1] if self.raw_samples else 512)
        bpm_val = bpm if bpm is not None else (self.bpm_samples[-1] if self.bpm_samples else 0)
        
        self.csv_writer.writerow([
            timestamp_iso,
            f"{elapsed:.3f}",
            raw_val,
            bpm_val,
            self.mode_label,
            event_text
        ])
        self.csv_file.flush()
        return True

    def pause_session(self) -> Dict[str, Any]:
        """Pause the current recording session."""
        if not self.is_recording or self.is_paused:
            return {"status": "ignored", "is_paused": self.is_paused}
            
        self.is_paused = True
        self.pause_start_time = time.time()
        return {"status": "paused"}

    def resume_session(self) -> Dict[str, Any]:
        """Resume recording after pause."""
        if not self.is_recording or not self.is_paused:
            return {"status": "ignored", "is_paused": self.is_paused}
            
        if self.pause_start_time:
            self.total_paused_duration += (time.time() - self.pause_start_time)
            self.pause_start_time = None
            
        self.is_paused = False
        return {"status": "resumed"}

    def log_point(self, raw_signal: int, bpm: int, mode: Optional[str] = None, event: str = ""):
        """Log an incoming pulse data point if session is actively recording."""
        if not self.is_recording or self.is_paused or not self.csv_file:
            return
            
        now = time.time()
        elapsed = now - self.start_time - self.total_paused_duration
        timestamp_iso = datetime.now().isoformat()
        active_mode = mode or self.mode_label
        
        # Write CSV row
        self.csv_writer.writerow([
            timestamp_iso,
            f"{elapsed:.3f}",
            raw_signal,
            bpm,
            active_mode,
            event
        ])
        
        # Real-time stats
        self.raw_samples.append(raw_signal)
        if bpm > 0:
            self.bpm_samples.append(bpm)
            
            # Baseline calculation during initial window
            if not self.baseline_locked:
                if elapsed <= self.baseline_duration:
                    self.baseline_samples.append(bpm)
                else:
                    if self.baseline_samples:
                        self.baseline_bpm = round(sum(self.baseline_samples) / len(self.baseline_samples), 1)
                    else:
                        self.baseline_bpm = float(bpm)
                    self.baseline_locked = True
                    
            if self.baseline_bpm is not None:
                delta = abs(bpm - self.baseline_bpm)
                if delta > self.max_delta_bpm:
                    self.max_delta_bpm = round(delta, 1)

    def end_session(self) -> Dict[str, Any]:
        """End recording, close CSV, and compute full session summary."""
        if not self.is_recording:
            return {"status": "no_active_session"}
            
        now = time.time()
        if self.is_paused and self.pause_start_time:
            self.total_paused_duration += (now - self.pause_start_time)
            
        total_duration = now - self.start_time - self.total_paused_duration
        self.is_recording = False
        self.is_paused = False
        
        if self.csv_file:
            self.csv_file.flush()
            self.csv_file.close()
            self.csv_file = None
            self.csv_writer = None
            
        # If baseline wasn't locked yet, compute from available baseline samples
        if not self.baseline_locked and self.baseline_samples:
            self.baseline_bpm = round(sum(self.baseline_samples) / len(self.baseline_samples), 1)
            self.baseline_locked = True
            
        # Summary statistics
        valid_bpms = self.bpm_samples
        avg_bpm = round(sum(valid_bpms) / len(valid_bpms), 1) if valid_bpms else 0.0
        min_bpm = min(valid_bpms) if valid_bpms else 0
        max_bpm = max(valid_bpms) if valid_bpms else 0
        baseline = self.baseline_bpm if self.baseline_bpm is not None else avg_bpm
        
        summary = {
            "session_id": self.session_id,
            "session_name": self.session_name,
            "mode": self.mode_label,
            "duration_seconds": round(total_duration, 2),
            "duration_formatted": f"{int(total_duration // 60):02d}:{int(total_duration % 60):02d}",
            "total_samples": len(self.raw_samples),
            "bpm_samples_count": len(valid_bpms),
            "average_bpm": avg_bpm,
            "minimum_bpm": min_bpm,
            "maximum_bpm": max_bpm,
            "baseline_bpm": baseline,
            "max_change_from_baseline": self.max_delta_bpm,
            "csv_filename": f"session_{self.session_id}.csv",
            "csv_path": self.csv_filepath
        }
        
        # Save summary JSON alongside the session CSV
        summary_path = os.path.join(self.storage_dir, f"session_{self.session_id}_summary.json")
        try:
            with open(summary_path, 'w', encoding='utf-8') as sf:
                json.dump(summary, sf, indent=2)
        except Exception as e:
            print(f"Error saving summary json: {e}")
            
        return summary

    def get_session_history(self) -> List[Dict[str, Any]]:
        """List all saved sessions with their summaries if available."""
        sessions = []
        if not os.path.exists(self.storage_dir):
            return sessions
            
        for file in os.listdir(self.storage_dir):
            if file.endswith("_summary.json"):
                try:
                    with open(os.path.join(self.storage_dir, file), 'r', encoding='utf-8') as f:
                        sessions.append(json.load(f))
                except Exception:
                    pass
        # Sort latest first
        sessions.sort(key=lambda s: s.get("session_id", ""), reverse=True)
        return sessions
