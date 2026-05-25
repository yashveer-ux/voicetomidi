# Hummed

**A browser-based DAW for non-musicians.** Record your voice or hum a melody → it converts to instrument tracks on a piano roll. Includes drum pads, beatbox detection, multi-track arrangement, and export to WAV / MP3 / MIDI.

**Live:** [voicetomidi.vercel.app](https://voicetomidi.vercel.app)

---

## What it does

- **Voice to melody** — hum or sing into your mic; librosa's pYIN pitch detection converts it to MIDI notes on the piano roll
- **Beatbox to drums** — beat-box into the mic; spectral analysis classifies kicks, snares, and hi-hats
- **Piano roll** — edit notes, drag to move, multi-track arrangement view
- **Drum pads** — click or tap to trigger drum sounds in real time
- **Instruments** — 100+ instruments via GeneralUser GS soundfont; import your own `.sf2`
- **Chords** — insert chord shapes directly into the piano roll
- **Export** — download your track as WAV, MP3, or MIDI (€1.00 per export via Stripe)
- **Save / load** — persist projects across sessions

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Zustand |
| Backend | Python 3.9 + FastAPI + librosa + mido + FluidSynth |
| Audio (frontend) | Web Audio API + soundfont-player |
| Audio (export) | FluidSynth + ffmpeg + GeneralUser GS soundfont |
| Payments | Stripe Checkout |
| Deployment | Vercel (frontend) + Railway (backend) |

## Running locally

**Requirements:** Node 18+, Python 3.9+, FluidSynth, ffmpeg

```bash
# Install system deps (macOS)
brew install fluidsynth ffmpeg

# Clone and start everything
git clone https://github.com/yashveer-ux/voicetomidi.git
cd voicetomidi
./start.sh
```

Frontend opens at `http://localhost:5174` · Backend at `http://localhost:8000`

The `start.sh` script creates a Python venv, installs all deps, and launches both servers.

## Project structure

```
voicetomidi/
├── start.sh                      ← launch everything
├── backend/
│   ├── main.py                   ← FastAPI entry point
│   ├── requirements.txt
│   ├── soundfonts/               ← GeneralUser GS .sf2
│   ├── routers/
│   │   ├── analyze.py            ← voice → MIDI, beatbox → drums
│   │   ├── synthesize.py         ← MIDI → WAV playback
│   │   ├── export.py             ← WAV / MP3 / MIDI export
│   │   └── project.py            ← save / load projects
│   └── services/
│       ├── audio_analyzer.py     ← librosa pYIN pitch detection
│       ├── beatbox_classifier.py ← spectral centroid classifier
│       ├── synth_engine.py       ← FluidSynth synthesis
│       └── export_service.py     ← multi-format export
└── frontend/
    └── src/
        ├── components/
        │   ├── PianoRoll.jsx     ← canvas piano roll
        │   ├── ArrangementView.jsx
        │   ├── Recorder.jsx      ← mic capture + waveform
        │   ├── DrumPadGrid.jsx
        │   └── ExportPanel.jsx
        ├── hooks/
        │   ├── useRecorder.js
        │   ├── useMetronome.js
        │   └── useSoundfont.js
        └── store/projectStore.js ← Zustand state
```

## License

[MIT](LICENSE)
