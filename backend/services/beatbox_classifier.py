"""
Beatbox drum classifier.
Receives up to 4 bars of audio, detects onsets, classifies each hit
as kick / snare / hihat based on spectral characteristics.
Returns hits mapped to drum pad indices (0=kick, 1=snare, 2=hihat, 3-7=open).
"""
import io
import numpy as np
import librosa
import soundfile as sf
from pydub import AudioSegment
from typing import List, Dict


def _to_wav_bytes(audio_bytes: bytes) -> bytes:
    seg = AudioSegment.from_file(io.BytesIO(audio_bytes))
    buf = io.BytesIO()
    seg.export(buf, format="wav")
    buf.seek(0)
    return buf.read()


# GM drum MIDI notes
DRUM_MIDI = {
    "kick": 36,
    "snare": 38,
    "hihat": 42,
    "clap": 39,
    "open_hihat": 46,
    "ride": 51,
    "crash": 49,
    "tom": 45,
}

PAD_LABELS = ["kick", "snare", "hihat", "clap", "open_hihat", "ride", "crash", "tom"]


def classify_onset(y_window: np.ndarray, sr: int) -> str:
    """Classify a single onset window into a drum sound type."""
    if len(y_window) < 64:
        return "kick"

    # Compute spectral centroid of the onset window
    centroid = librosa.feature.spectral_centroid(y=y_window, sr=sr)
    mean_centroid = float(np.mean(centroid))

    # Compute zero crossing rate (high = hihats/noise)
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y_window)))

    # Simple band-based classification
    if mean_centroid < 300:
        return "kick"
    elif mean_centroid < 800 and zcr < 0.15:
        return "snare"
    elif zcr > 0.3 or mean_centroid > 3000:
        return "hihat"
    elif mean_centroid < 1500:
        return "snare"
    else:
        return "hihat"


def analyze_beatbox(audio_bytes: bytes, bpm: float, bars: int = 4) -> List[Dict]:
    """
    Analyze beatbox recording and return classified drum hits.

    Returns:
        List of dicts: [{pad_index, label, midi_note, start_time, velocity}]
    """
    wav_bytes = _to_wav_bytes(audio_bytes)
    audio_buffer = io.BytesIO(wav_bytes)
    y, sr = sf.read(audio_buffer, dtype="float32")

    if y.ndim > 1:
        y = y.mean(axis=1)

    # Onset detection with percussive separation
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    onset_frames = librosa.onset.onset_detect(
        y=y_percussive, sr=sr, units="frames", backtrack=True, delta=0.07
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    hits = []
    for i, onset_time in enumerate(onset_times):
        end_time = onset_times[i + 1] if i + 1 < len(onset_times) else onset_time + 0.2
        start_sample = int(onset_time * sr)
        end_sample = int(end_time * sr)
        window = y[start_sample:end_sample]

        label = classify_onset(window, sr)
        pad_index = PAD_LABELS.index(label)
        midi_note = DRUM_MIDI[label]

        rms = float(np.sqrt(np.mean(window ** 2))) if len(window) > 0 else 0
        velocity = int(np.clip(rms * 1000, 40, 127))

        hits.append({
            "pad_index": pad_index,
            "label": label,
            "midi_note": midi_note,
            "start_time": round(float(onset_time), 4),
            "velocity": velocity,
        })

    return hits
