"""
Export service: renders a full project to WAV, MP3, or MIDI.
"""
import io
import os
import numpy as np
import soundfile as sf
import mido
from mido import MidiFile, MidiTrack, Message
from typing import List, Dict, Optional

from .synth_engine import synthesize


def export_midi(notes: List[Dict], drum_hits: List[Dict], bpm: float = 120.0) -> bytes:
    """Export project to a MIDI file."""
    mid = MidiFile(ticks_per_beat=480)
    tempo = mido.bpm2tempo(bpm)

    # Melody track
    melody = MidiTrack()
    mid.tracks.append(melody)
    melody.append(mido.MetaMessage("set_tempo", tempo=tempo, time=0))
    melody.append(mido.MetaMessage("track_name", name="Melody", time=0))

    def secs_to_ticks(secs: float) -> int:
        return int(secs * (480 * bpm / 60))

    # Build events sorted by absolute tick
    events = []
    for n in notes:
        on_tick = secs_to_ticks(n["start_time"])
        off_tick = secs_to_ticks(n["start_time"] + n["duration"])
        events.append((on_tick, "note_on", n["note"], n.get("velocity", 80)))
        events.append((off_tick, "note_off", n["note"], 0))

    events.sort()
    prev_tick = 0
    for abs_tick, msg_type, note, vel in events:
        delta = abs_tick - prev_tick
        if msg_type == "note_on":
            melody.append(Message("note_on", note=note, velocity=vel, time=delta))
        else:
            melody.append(Message("note_off", note=note, velocity=0, time=delta))
        prev_tick = abs_tick

    # Drum track (channel 9)
    if drum_hits:
        drums = MidiTrack()
        mid.tracks.append(drums)
        drums.append(mido.MetaMessage("track_name", name="Drums", time=0))

        drum_events = []
        for h in drum_hits:
            tick = secs_to_ticks(h["start_time"])
            drum_events.append((tick, h.get("note", 36), h.get("velocity", 80)))

        drum_events.sort()
        prev_tick = 0
        for abs_tick, note, vel in drum_events:
            delta = abs_tick - prev_tick
            drums.append(Message("note_on", channel=9, note=note, velocity=vel, time=delta))
            drums.append(Message("note_off", channel=9, note=note, velocity=0, time=10))
            prev_tick = abs_tick

    buf = io.BytesIO()
    mid.save(file=buf)
    buf.seek(0)
    return buf.read()


def mix_audio(melody_wav: bytes, drums_wav: bytes) -> np.ndarray:
    """Mix two WAV byte streams into a single numpy array."""
    sr = 44100

    def load(wav_bytes: bytes) -> np.ndarray:
        buf = io.BytesIO(wav_bytes)
        y, _ = sf.read(buf, dtype="float32")
        if y.ndim > 1:
            y = y.mean(axis=1)
        return y

    melody = load(melody_wav) if melody_wav else np.zeros(sr, dtype=np.float32)
    drums = load(drums_wav) if drums_wav else np.zeros(sr, dtype=np.float32)

    # Pad shorter array
    max_len = max(len(melody), len(drums))
    melody = np.pad(melody, (0, max_len - len(melody)))
    drums = np.pad(drums, (0, max_len - len(drums)))

    mixed = melody * 0.7 + drums * 0.6
    peak = np.max(np.abs(mixed))
    if peak > 0:
        mixed = mixed / peak * 0.9
    return mixed, sr


def export_wav(melody_wav: bytes, drums_wav: bytes) -> bytes:
    mixed, sr = mix_audio(melody_wav, drums_wav)
    buf = io.BytesIO()
    sf.write(buf, mixed, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return buf.read()


def export_mp3(melody_wav: bytes, drums_wav: bytes) -> Optional[bytes]:
    """Export to MP3. Returns None if ffmpeg is unavailable."""
    try:
        from pydub import AudioSegment
    except ImportError:
        return None

    mixed, sr = mix_audio(melody_wav, drums_wav)
    wav_buf = io.BytesIO()
    sf.write(wav_buf, mixed, sr, format="WAV", subtype="PCM_16")
    wav_buf.seek(0)

    try:
        segment = AudioSegment.from_wav(wav_buf)
        mp3_buf = io.BytesIO()
        segment.export(mp3_buf, format="mp3", bitrate="192k")
        mp3_buf.seek(0)
        return mp3_buf.read()
    except Exception:
        return None
