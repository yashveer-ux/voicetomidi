"""
Audio analysis service.
Receives raw audio (any browser format), returns detected MIDI notes.
Uses librosa pYIN for pitch detection and onset detection.
"""
import io
import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment
from typing import List, Dict


def _to_wav_bytes(audio_bytes: bytes) -> bytes:
    """Convert any audio format (webm, ogg, mp3, wav) to WAV bytes using pydub/ffmpeg."""
    try:
        seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
        buf = io.BytesIO()
        seg.export(buf, format="wav")
        buf.seek(0)
        return buf.read()
    except Exception as e:
        raise ValueError(f"Could not decode audio: {e}")


def analyze_audio(audio_bytes: bytes, bpm: float = 120.0) -> List[Dict]:
    """
    Analyze audio bytes and return a list of detected MIDI notes.

    Returns:
        List of dicts: [{note, start_time, duration, velocity}]
    """
    wav_bytes = _to_wav_bytes(audio_bytes)
    audio_buffer = io.BytesIO(wav_bytes)
    y, sr = sf.read(audio_buffer, dtype="float32")

    # Convert stereo to mono if needed
    if y.ndim > 1:
        y = y.mean(axis=1)

    if len(y) < sr * 0.5:
        return []  # Clip too short

    # Onset detection
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, units="frames", backtrack=True
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    # pYIN pitch detection
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
    )
    times = librosa.times_like(f0, sr=sr)

    notes = []
    for i, onset_time in enumerate(onset_times):
        end_time = onset_times[i + 1] if i + 1 < len(onset_times) else len(y) / sr

        # Collect pitches in this onset window
        mask = (times >= onset_time) & (times < end_time) & voiced_flag
        window_f0 = f0[mask]

        if len(window_f0) == 0:
            continue

        median_hz = float(np.median(window_f0[window_f0 > 0])) if np.any(window_f0 > 0) else 0
        if median_hz <= 0:
            continue

        midi_note = int(round(librosa.hz_to_midi(median_hz)))
        midi_note = max(0, min(127, midi_note))

        duration = end_time - onset_time

        # Estimate velocity from RMS of the window
        start_sample = int(onset_time * sr)
        end_sample = int(end_time * sr)
        window_audio = y[start_sample:end_sample]
        rms = float(np.sqrt(np.mean(window_audio ** 2))) if len(window_audio) > 0 else 0
        velocity = int(np.clip(rms * 800, 40, 127))

        notes.append({
            "note": midi_note,
            "start_time": round(onset_time, 4),
            "duration": round(duration, 4),
            "velocity": velocity,
        })

    notes = _remove_outliers(notes)
    notes = _merge_close_notes(notes, gap_threshold=0.15)
    return notes


def _remove_outliers(notes: List[Dict]) -> List[Dict]:
    """
    Remove notes that are statistical outliers in pitch.
    Uses the interquartile range — anything beyond Q1/Q3 ± 1.5*IQR is dropped.
    Also removes very short isolated notes (likely detection artifacts).
    """
    if len(notes) < 4:
        return notes

    pitches = np.array([n["note"] for n in notes])
    q1, q3 = np.percentile(pitches, 25), np.percentile(pitches, 75)
    iqr = q3 - q1
    lo = q1 - 1.5 * iqr
    hi = q3 + 1.5 * iqr

    # Also enforce a hard minimum duration (< 80ms = artifact)
    return [n for n in notes if lo <= n["note"] <= hi and n["duration"] >= 0.08]


def _merge_close_notes(notes: List[Dict], gap_threshold: float = 0.15) -> List[Dict]:
    """
    Merge consecutive notes of the same pitch whose gap is smaller than gap_threshold.
    This turns fragmented detections of one sustained note into a single long note.
    """
    if not notes:
        return notes

    notes = sorted(notes, key=lambda n: n["start_time"])
    merged = []
    current = dict(notes[0])

    for nxt in notes[1:]:
        same_pitch = nxt["note"] == current["note"]
        gap = nxt["start_time"] - (current["start_time"] + current["duration"])
        if same_pitch and gap <= gap_threshold:
            # Extend current note to absorb nxt
            current["duration"] = round(
                nxt["start_time"] + nxt["duration"] - current["start_time"], 4
            )
            current["velocity"] = max(current["velocity"], nxt["velocity"])
        else:
            merged.append(current)
            current = dict(nxt)

    merged.append(current)
    return merged
