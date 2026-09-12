"""
BEYOND THE FACADE - Demo Mode Pulse Signal Simulator
Simulates physiologically realistic Photoplethysmogram (PPG) waveform
and heart rate dynamics for presentation and testing when physical Arduino hardware is absent.
"""

import math
import time
import random

class DemoPulseSimulator:
    def __init__(self, sample_rate_hz=35.0):
        self.sample_rate_hz = sample_rate_hz
        self.interval = 1.0 / sample_rate_hz
        self.t = 0.0
        
        # Physiological parameters
        self.base_bpm = 70.0
        self.current_bpm = 70.0
        self.target_bpm = 84.0
        self.last_bpm_change_time = time.time()
        self.ramp_active = False
        self.ramp_start_time = 0.0
        
        # Baseline wander & noise parameters
        self.baseline_offset = 512.0
        self.amplitude = 180.0
        self.respiration_rate_hz = 0.25  # ~15 breaths per min
        
        # Heart beat timing
        self.beat_phase = 0.0  # 0.0 to 1.0 within the current cardiac cycle
        self.last_update_time = time.time()
        self.finger_present = True
        
    def reset_pulse_ramp(self):
        """Initializes pulse reading at 70 BPM and targets 80-90 BPM range."""
        self.current_bpm = 70.0
        self.target_bpm = random.uniform(83.0, 88.0)
        self.ramp_active = True
        self.ramp_start_time = time.time()
        self.last_bpm_change_time = time.time()

    def set_target_bpm(self, bpm: float):
        """Set target BPM for dynamic response simulation."""
        self.target_bpm = max(80.0, min(90.0, bpm))

    def step(self):
        """
        Calculates the next simulated sample.
        Returns a tuple: (raw_signal: int, bpm: int, is_beat: bool)
        """
        now = time.time()
        dt = now - self.last_update_time
        if dt <= 0 or dt > 0.5:
            dt = self.interval
        self.last_update_time = now
        self.t += dt

        # Physiological ramp: Start at 70 BPM, transition smoothly into 80-90 BPM
        if self.ramp_active:
            if self.current_bpm < 80.0:
                # Smoothly climb from 70 towards 82+ over ~3 seconds
                self.current_bpm += dt * 3.6
            else:
                self.ramp_active = False
                self.current_bpm = max(80.0, min(90.0, self.current_bpm))
        else:
            # Subtle physiological wander strictly bounded between 80 and 90 BPM
            if now - self.last_bpm_change_time > 3.0:
                self.target_bpm = random.uniform(81.0, 89.0)
                self.last_bpm_change_time = now
                
            # Smooth exponential approach to target BPM within 80-90
            self.current_bpm += (self.target_bpm - self.current_bpm) * (dt * 0.75)
            self.current_bpm = max(80.0, min(90.0, self.current_bpm))

        # Cardiac cycle period in seconds
        beat_period = 60.0 / max(40.0, self.current_bpm)
        
        # Advance beat phase (0.0 to 1.0)
        self.beat_phase += (dt / beat_period)
        is_beat = False
        if self.beat_phase >= 1.0:
            self.beat_phase -= 1.0
            is_beat = True

        if not self.finger_present:
            # Low noise flatline around baseline
            noise = random.gauss(0, 3.0)
            return int(self.baseline_offset + noise), 0, False

        # Construct realistic PPG pulse morphology:
        # Sum of Gaussian-like curves:
        # 1. Systolic peak (sharp rise around phase ~ 0.18)
        # 2. Dicrotic notch (dip around phase ~ 0.35)
        # 3. Diastolic peak (secondary rise around phase ~ 0.45)
        p = self.beat_phase
        
        # Systolic component
        p1 = 0.18
        w1 = 0.07
        systolic = math.exp(-((p - p1) ** 2) / (2 * (w1 ** 2)))
        
        # Diastolic wave component
        p2 = 0.44
        w2 = 0.10
        diastolic = 0.42 * math.exp(-((p - p2) ** 2) / (2 * (w2 ** 2)))
        
        # Dicrotic reflection dip
        p_notch = 0.32
        w_notch = 0.04
        notch_dip = -0.15 * math.exp(-((p - p_notch) ** 2) / (2 * (w_notch ** 2)))
        
        # Combined normalized pulse signal
        pulse_shape = systolic + diastolic + notch_dip
        
        # Gentle respiratory baseline modulation (wander)
        resp_wander = 18.0 * math.sin(2 * math.pi * self.respiration_rate_hz * self.t)
        
        # High-frequency micro-jitter
        jitter = random.gauss(0, 2.0)
        
        # Total raw ADC signal (scaled to 0-1023 range, centered near 520)
        raw_val = self.baseline_offset + resp_wander + (pulse_shape * self.amplitude) + jitter
        raw_signal = int(max(10, min(1020, raw_val)))
        
        return raw_signal, int(round(self.current_bpm)), is_beat
