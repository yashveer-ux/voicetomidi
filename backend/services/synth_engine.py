"""
Synthesis engine.
Converts MIDI notes + instrument choice into rendered WAV audio bytes.
Uses FluidSynth via pyfluidsynth.
Falls back to a pure-numpy sine wave generator if FluidSynth is unavailable.
"""
import io
import os
import struct
import numpy as np
import soundfile as sf
from typing import List, Dict

SOUNDFONT_DIR = os.path.join(os.path.dirname(__file__), "..", "soundfonts")

# Maps instrument name → soundfont filename + program number
INSTRUMENT_MAP = {
    "piano":   ("GeneralUser.sf2", 0),
    "guitar":  ("GeneralUser.sf2", 25),
    "synth":   ("GeneralUser.sf2", 81),
    "strings": ("GeneralUser.sf2", 48),
}


def _sine_fallback(notes: List[Dict], sr: int = 44100) -> np.ndarray:
    """Pure-numpy fallback synthesizer using sine waves."""
    if not notes:
        return np.zeros(sr, dtype=np.float32)

    total_duration = max(n["start_time"] + n["duration"] for n in notes) + 0.5
    audio = np.zeros(int(total_duration * sr), dtype=np.float32)

    for note in notes:
        midi = note["note"]
        freq = 440.0 * (2 ** ((midi - 69) / 12.0))
        duration = note["duration"]
        velocity = note.get("velocity", 80) / 127.0
        start_sample = int(note["start_time"] * sr)
        num_samples = int(duration * sr)

        t = np.linspace(0, duration, num_samples, endpoint=False)
        wave = velocity * 0.3 * np.sin(2 * np.pi * freq * t)

        # Simple envelope (attack + release)
        attack = min(int(0.01 * sr), num_samples // 4)
        release = min(int(0.05 * sr), num_samples // 4)
        envelope = np.ones(num_samples)
        if attack > 0:
            envelope[:attack] = np.linspace(0, 1, attack)
        if release > 0:
            envelope[-release:] = np.linspace(1, 0, release)
        wave *= envelope

        end_sample = start_sample + num_samples
        if end_sample > len(audio):
            wave = wave[: len(audio) - start_sample]
            end_sample = len(audio)

        audio[start_sample:end_sample] += wave

    # Normalize
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.9

    return audio


def synthesize(notes: List[Dict], instrument: str = "piano", bpm: float = 120.0) -> bytes:
    """
    Render MIDI notes to WAV bytes.

    Args:
        notes: List of {note, start_time, duration, velocity}
        instrument: One of piano/guitar/synth/strings
        bpm: Beats per minute (used for context, not tempo-stretching here)

    Returns:
        WAV file bytes
    """
    sr = 44100

    # Try FluidSynth first
    try:
        import fluidsynth
        sf_name, program = INSTRUMENT_MAP.get(instrument, ("GeneralUser.sf2", 0))
        sf_path = os.path.join(SOUNDFONT_DIR, sf_name)

        if os.path.exists(sf_path):
            return _fluidsynth_render(notes, sf_path, program, sr)
    except ImportError:
        pass

    # Fallback to sine waves
    audio = _sine_fallback(notes, sr)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="FLOAT")
    buf.seek(0)
    return buf.read()


def _fluidsynth_render(notes: List[Dict], sf_path: str, program: int, sr: int) -> bytes:
    """Render notes using FluidSynth."""
    import fluidsynth

    if not notes:
        buf = io.BytesIO()
        sf.write(buf, np.zeros(sr, dtype=np.float32), sr, format="WAV", subtype="FLOAT")
        buf.seek(0)
        return buf.read()

    total_duration = max(n["start_time"] + n["duration"] for n in notes) + 1.0
    total_samples = int(total_duration * sr)
    audio = np.zeros(total_samples, dtype=np.float32)

    fs = fluidsynth.Synth(samplerate=float(sr))
    sfid = fs.sfload(sf_path)
    fs.program_select(0, sfid, 0, program)

    chunk_size = 256
    current_sample = 0
    note_events = []

    # Build sorted event list: (sample, "on"/"off", note, velocity)
    for n in notes:
        on_sample = int(n["start_time"] * sr)
        off_sample = int((n["start_time"] + n["duration"]) * sr)
        note_events.append((on_sample, "on", n["note"], n.get("velocity", 80)))
        note_events.append((off_sample, "off", n["note"], 0))

    note_events.sort(key=lambda x: x[0])
    event_idx = 0

    while current_sample < total_samples:
        # Fire any events due this chunk
        while event_idx < len(note_events) and note_events[event_idx][0] <= current_sample:
            _, evt_type, note, vel = note_events[event_idx]
            if evt_type == "on":
                fs.noteon(0, note, vel)
            else:
                fs.noteoff(0, note)
            event_idx += 1

        samples = fs.get_samples(chunk_size)
        chunk = np.array(samples, dtype=np.float32).reshape(-1, 2).mean(axis=1) / 32768.0
        end = min(current_sample + len(chunk), total_samples)
        audio[current_sample:end] += chunk[: end - current_sample]
        current_sample += chunk_size

    fs.delete()

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.9

    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="FLOAT")
    buf.seek(0)
    return buf.read()


def synthesize_drums_midi(hits: List[Dict], bpm: float = 120.0) -> bytes:
    """
    Render drum hits to WAV using FluidSynth channel 9 (GM percussion).
    Falls back to a simple numpy approximation if FluidSynth is unavailable.

    hits: [{note, start_time, duration, velocity}]
    """
    sr = 44100

    if not hits:
        buf = io.BytesIO()
        sf.write(buf, np.zeros(sr, dtype=np.float32), sr, format="WAV", subtype="FLOAT")
        buf.seek(0)
        return buf.read()

    try:
        import fluidsynth
        sf_path = os.path.join(SOUNDFONT_DIR, "GeneralUser.sf2")
        if os.path.exists(sf_path):
            return _fluidsynth_render_drums(hits, sf_path, sr)
    except ImportError:
        pass

    return _numpy_drums_fallback(hits, sr)


def _fluidsynth_render_drums(hits: List[Dict], sf_path: str, sr: int) -> bytes:
    """Render drum hits using FluidSynth on MIDI channel 9."""
    import fluidsynth

    total_duration = max(h["start_time"] for h in hits) + 1.5
    total_samples = int(total_duration * sr)
    audio = np.zeros(total_samples, dtype=np.float32)

    fs = fluidsynth.Synth(samplerate=float(sr))
    sfid = fs.sfload(sf_path)
    # Bank 128 = GM percussion bank, preset 0
    fs.program_select(9, sfid, 128, 0)

    chunk_size = 256
    current_sample = 0

    # Build event list: (sample, "on"/"off", note, velocity)
    events = []
    for h in hits:
        on_sample = int(h["start_time"] * sr)
        dur = h.get("duration", 0.1)
        off_sample = int((h["start_time"] + max(dur, 0.05)) * sr)
        events.append((on_sample, "on", h["note"], h.get("velocity", 80)))
        events.append((off_sample, "off", h["note"], 0))

    events.sort(key=lambda x: x[0])
    event_idx = 0

    while current_sample < total_samples:
        while event_idx < len(events) and events[event_idx][0] <= current_sample:
            _, evt_type, note, vel = events[event_idx]
            if evt_type == "on":
                fs.noteon(9, note, vel)
            else:
                fs.noteoff(9, note)
            event_idx += 1

        samples = fs.get_samples(chunk_size)
        chunk = np.array(samples, dtype=np.float32).reshape(-1, 2).mean(axis=1) / 32768.0
        end = min(current_sample + len(chunk), total_samples)
        audio[current_sample:end] += chunk[: end - current_sample]
        current_sample += chunk_size

    fs.delete()

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.9

    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="FLOAT")
    buf.seek(0)
    return buf.read()


def _numpy_drums_fallback(hits: List[Dict], sr: int) -> bytes:
    """Simple numpy drum fallback: kick=sine sweep, snare=noise burst, hihat=highpass noise."""
    total_duration = max(h["start_time"] for h in hits) + 1.5
    audio = np.zeros(int(total_duration * sr), dtype=np.float32)

    for h in hits:
        note = h["note"]
        vel = h.get("velocity", 80) / 127.0
        start = int(h["start_time"] * sr)

        if note == 36:  # kick
            dur = int(0.35 * sr)
            t = np.linspace(0, 0.35, dur)
            freq = 150 * np.exp(-t * 10)
            wave = vel * np.sin(2 * np.pi * np.cumsum(freq) / sr)
            env = np.exp(-t * 8)
        elif note in (38, 40):  # snare
            dur = int(0.18 * sr)
            wave = vel * 0.6 * np.random.randn(dur)
            env = np.exp(-np.linspace(0, 8, dur))
        elif note in (42, 46, 51, 59):  # hihat / ride
            dur = int((0.35 if note == 46 else 0.06) * sr)
            wave = vel * 0.3 * np.random.randn(dur)
            env = np.exp(-np.linspace(0, 12, dur))
        elif note in (49, 57):  # crash
            dur = int(0.8 * sr)
            wave = vel * 0.25 * np.random.randn(dur)
            env = np.exp(-np.linspace(0, 5, dur))
        else:  # toms
            freq_map = {45: 160, 50: 280}
            f = freq_map.get(note, 200)
            dur = int(0.22 * sr)
            t = np.linspace(0, 0.22, dur)
            wave = vel * 0.8 * np.sin(2 * np.pi * f * t)
            env = np.exp(-t * 18)

        wave = (wave * env).astype(np.float32)
        end = min(start + len(wave), len(audio))
        audio[start:end] += wave[: end - start]

    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio / peak * 0.9

    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="FLOAT")
    buf.seek(0)
    return buf.read()


def synthesize_drums(hits: List[Dict], drum_clips: Dict[int, bytes], bpm: float = 120.0) -> bytes:
    """
    Mix drum pad hits into a single WAV.
    drum_clips: {pad_index: wav_bytes}
    hits: [{pad_index, start_time, velocity}]
    """
    sr = 44100

    if not hits:
        buf = io.BytesIO()
        sf.write(buf, np.zeros(sr, dtype=np.float32), sr, format="WAV", subtype="FLOAT")
        buf.seek(0)
        return buf.read()

    total_duration = max(h["start_time"] for h in hits) + 2.0
    mix = np.zeros(int(total_duration * sr), dtype=np.float32)

    # Load each pad clip
    clip_arrays: Dict[int, np.ndarray] = {}
    for pad_idx, clip_bytes in drum_clips.items():
        clip_buf = io.BytesIO(clip_bytes)
        clip_y, clip_sr = sf.read(clip_buf, dtype="float32")
        if clip_y.ndim > 1:
            clip_y = clip_y.mean(axis=1)
        if clip_sr != sr:
            import librosa
            clip_y = librosa.resample(clip_y, orig_sr=clip_sr, target_sr=sr)
        clip_arrays[pad_idx] = clip_y

    for hit in hits:
        pad_idx = hit["pad_index"]
        if pad_idx not in clip_arrays:
            continue
        clip = clip_arrays[pad_idx]
        vel_scale = hit.get("velocity", 80) / 127.0
        start_sample = int(hit["start_time"] * sr)
        end_sample = start_sample + len(clip)
        if end_sample > len(mix):
            clip = clip[: len(mix) - start_sample]
            end_sample = len(mix)
        mix[start_sample:end_sample] += clip * vel_scale

    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.9

    buf = io.BytesIO()
    sf.write(buf, mix, sr, format="WAV", subtype="FLOAT")
    buf.seek(0)
    return buf.read()
