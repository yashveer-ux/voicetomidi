# Hummed — Project Plan

**Last updated:** 2026-04-12
**Status:** Active development — core features complete, refining for deployment

---

## Goal
A browser-based DAW for non-musicians. Record your voice → convert to instrument tracks on a piano roll. Includes drum pads, beatbox detection, export to WAV/MP3/MIDI.

## Tech Stack
- **Backend:** Python 3.9 + FastAPI + librosa + mido + FluidSynth
- **Frontend:** React 18 + Vite + Zustand

---

## Progress

### Phase 1: Foundation ✅
- [x] Project scaffolded at `/Users/yashveersookun/Desktop/Hummed`
- [x] Python venv created + all deps installed
- [x] React app created with Vite + Zustand + Axios
- [x] System deps: FluidSynth + ffmpeg via brew

### Phase 2: Backend Services ✅
- [x] `services/audio_analyzer.py` — librosa pYIN pitch detection + onset detection
- [x] `services/beatbox_classifier.py` — spectral centroid classifier for kick/snare/hihat
- [x] `services/synth_engine.py` — FluidSynth synthesis with sine wave fallback
- [x] `services/export_service.py` — WAV, MP3, MIDI export

### Phase 3: Backend API ✅
- [x] `POST /analyze` — voice → MIDI notes
- [x] `POST /analyze/beatbox` — beatbox → drum hits
- [x] `POST /synthesize` — MIDI → WAV playback
- [x] `POST /export` — full export (WAV/MP3/MIDI)
- [x] `POST /project/save` + `GET /project/{id}` — project persistence
- [x] `WS /ws/playback` — playback sync
- ~~`POST /ai/compose` — Claude API AI composer~~ (removed)

### Phase 4: Frontend ✅
- [x] `store/projectStore.js` — Zustand state (notes, bpm, instrument, drums, volume per track)
- [x] `api/client.js` — all backend API calls
- [x] `hooks/useRecorder.js` — MediaRecorder mic capture + exposes streamRef
- [x] `hooks/useMetronome.js` — Web Audio API click track
- [x] `hooks/useSoundfont.js` — soundfont-player wrapper, accepts volume param
- [x] `hooks/useDrumSynth.js` — Web Audio drum synthesis, accepts volume param
- [x] `components/TransportBar.jsx` — play/stop/BPM/metronome/loop bars
- [x] `components/Recorder.jsx` — record + waveform display + "Send to Piano Roll" button
- [x] `components/InstrumentPalette.jsx` — presets + .sf2 import
- [x] `components/PianoRoll.jsx` — canvas piano roll, melody + drum mode, no auto-scroll
- [x] `components/ArrangementView.jsx` — multi-track dashboard, all tracks visible, drag to reposition notes, inline rename, per-track volume knob
- [x] `components/Knob.jsx` — rotary knob (SVG, drag up/down, 0–150%)
- [x] `components/ExportPanel.jsx` — save/load/export
- [x] ~~`components/AIChatPanel.jsx` — AI chat composer via Claude API~~ (removed)
- [x] `components/TrackList.jsx` — sidebar with track controls, double-click rename
- [x] `App.jsx` — full layout: ArrangementView above PianoRoll

### Phase 5: Refinements (this session) ✅
- [x] Visual waveform display in Recorder — live oscilloscope (orange) during recording, static decoded waveform (teal) after
- [x] "Send to Piano Roll" button — analysis result held pending, user confirms before applying to track
- [x] Piano roll lower octaves fix — `alignItems: flex-start` + `overflowY: visible` on scroll area, notes now visible at all pitch ranges
- [x] ArrangementView — multi-track timeline dashboard with draggable note blocks (snaps to 16th note)
- [x] Track renaming — double-click in both TrackList and ArrangementView
- [x] Per-track volume knob — rotary SVG knob in ArrangementView, applied to playback gain
- [x] Drag-to-move note fix in PianoRoll — auto-scroll no longer fires on every drag frame
- [x] Removed auto-scroll on note placement — piano roll stays in place when adding notes

### Phase 6: SoundFont ✅
- [x] GeneralUser GS v1.471 (30MB) downloaded from ad-si/GeneralUser GitHub (git-lfs)
- [x] Replaces old VintageDreamsWaves symlink at `backend/soundfonts/GeneralUser.sf2`
- [x] Verified FluidSynth loads it (piano=0, guitar=25, synth=81, strings=48)

---

## How to Run

```bash
cd /Users/yashveersookun/Desktop/Hummed
./start.sh
```

Frontend opens at http://localhost:5174 (5173 may be in use)
Backend at http://localhost:8000

---

## Deployed ✅

- [x] Mobile-responsive layout
- [x] Hosting: Railway (backend) + Vercel (frontend) — live at https://voicetomidi.vercel.app
- [x] Stripe €1.00 per export (checkout.py)
- [x] Multi-track melody stacking
- [x] ChordPanel — chord insertion into piano roll
- [x] DrumPadGrid — per-pad recording + beatbox analysis

## Remaining (Post-Launch Polish)

- [ ] Error tracking (Sentry — ~30 min)
- [ ] Traffic analytics (Vercel Analytics — ~5 min)
- ~~WebSocket playhead sync~~ — not needed, playback is client-side

---

## File Structure

```
Hummed/
├── start.sh                        ← run this to launch everything
├── PLAN.md                         ← this file
├── backend/
│   ├── main.py                     ← FastAPI entry point
│   ├── venv/                       ← Python virtual env
│   ├── requirements.txt
│   ├── soundfonts/
│   │   └── GeneralUser.sf2         ← GeneralUser GS v1.471 (30MB, real file not symlink)
│   ├── projects/                   ← saved .json project files
│   ├── routers/
│   │   ├── analyze.py
│   │   ├── synthesize.py
│   │   ├── export.py
│   │   ├── project.py
│   │   └── ai.py
│   └── services/
│       ├── audio_analyzer.py
│       ├── beatbox_classifier.py
│       ├── synth_engine.py
│       └── export_service.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── api/client.js
│   │   ├── store/projectStore.js
│   │   ├── hooks/
│   │   │   ├── useRecorder.js      ← exposes streamRef for waveform
│   │   │   ├── useMetronome.js
│   │   │   ├── useSoundfont.js     ← volume param added
│   │   │   └── useDrumSynth.js     ← volume param added
│   │   └── components/
│   │       ├── TransportBar.jsx
│   │       ├── Recorder.jsx        ← waveform canvas + Send to Piano Roll button
│   │       ├── InstrumentPalette.jsx
│   │       ├── PianoRoll.jsx       ← no auto-scroll, lower octaves visible
│   │       ├── ArrangementView.jsx ← NEW: multi-track dashboard + volume knobs
│   │       ├── Knob.jsx            ← NEW: rotary SVG knob component
│   │       ├── AIChatPanel.jsx
│   │       ├── TrackList.jsx
│   │       └── ExportPanel.jsx
│   └── package.json
└── docs/
    └── superpowers/
        └── specs/2026-04-02-hummed-design.md
```

---

## Key Decisions Log
- **Drums**: Web Audio synthesis (not soundfont) — soundfont percussion was inaudible
- **webm→WAV**: pydub/ffmpeg on backend — soundfile can't read browser MediaRecorder output
- **Frontend playback**: soundfont-player (MusyngKite CDN) for melody, Web Audio for drums
- **Backend playback/export**: FluidSynth + GeneralUser GS
- **Deployment target**: Railway (Python backend) + Vercel (React frontend) — not serverless-compatible due to librosa/FluidSynth/ffmpeg
- **AI removed**: AIChatPanel, /ai/compose endpoint, and anthropic SDK dependency all removed (2026-04-12)
