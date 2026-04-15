# Hummed — Design Spec
**Date:** 2026-04-02
**Status:** Approved

---

## Overview

Hummed is a browser-based DAW for non-musicians. Users record their voice or any sound, which is automatically converted into instrument tracks on a piano roll. The goal is to make music creation accessible to anyone — no music theory or technical knowledge required.

---

## Target User

Non-musicians who want to make music by singing, humming, or making sounds with their mouth or environment.

---

## Architecture

```
Browser (React)
    ↕ HTTP / WebSocket
FastAPI (Python)
    ├── Audio Processor (librosa + aubio)  → pitch detection, onset detection
    ├── MIDI Engine (mido)                 → voice → MIDI notes
    ├── Instrument Synth (FluidSynth)      → MIDI → audio playback
    └── Export Service (soundfile, mido)   → WAV / MP3 / MIDI export
```

- The browser handles UI, mic recording, and playback.
- The backend handles all heavy audio processing.
- REST API for file operations; WebSocket for real-time playback sync.
- Runs locally at `localhost` — no deployment required for the prototype.

---

## Components

### Frontend (React)

| Component | Description |
|---|---|
| **Recorder** | Captures mic input via `getUserMedia`, records audio clip, sends to backend |
| **Instrument Palette** | Preset buttons: Piano, Guitar, Synth, Strings + "Import Instrument" (custom SoundFont `.sf2` upload) |
| **Piano Roll** | Grid editor showing detected notes; notes are draggable, resizable, deletable |
| **Drum Pad Grid** | 8-pad grid; each pad has a Record button for manual sound assignment; Beatboxing mode records up to 4 bars and auto-maps hits |
| **Transport Bar** | Play, Stop, BPM input, timeline position scrubber |
| **Metronome** | Toggle button in top-right corner; plays click track via Web Audio API during recording; respects current BPM |
| **Export Panel** | Buttons for Save Project / Export WAV / Export MP3 / Export MIDI |

### Backend (Python / FastAPI)

| Endpoint | Description |
|---|---|
| `POST /analyze` | Receives audio blob, returns `[{note, start_time, duration, velocity}]` |
| `POST /synthesize` | Receives MIDI data + instrument choice, returns rendered audio |
| `POST /export` | Handles WAV, MP3, MIDI file generation and download |
| `POST /project/save` | Persists full project state to `.hummed` file |
| `GET /project/load` | Loads a `.hummed` project file |
| `WS /ws/playback` | Streams playback position to sync the UI timeline |

---

## Data Flow

1. **Record** — user clicks Record; browser captures mic audio via `getUserMedia`; sends WAV blob to `POST /analyze`
2. **Analyze** — backend runs pitch detection (aubio/librosa) + onset detection → returns list of `{note, start_time, duration, velocity}`
3. **Piano Roll** — frontend renders detected notes on the grid; user can edit freely
4. **Synthesize** — user picks instrument + hits Play → frontend sends MIDI + instrument choice to `POST /synthesize` → backend renders audio via FluidSynth → streams back to browser
5. **Drum Pads (Manual)** — user records a sound clip per pad → stored as raw audio, mixed into final render during playback
6. **Drum Pads (Beatboxing)** — user records up to 4 bars; backend uses onset detection + frequency profiling to classify hits (low freq = kick, mid = snare, high transient = hi-hat) → auto-maps to drum grid; user can reassign
7. **Export** — `POST /export` receives full project state (MIDI tracks + drum clips + instrument choices + BPM) → backend renders and returns file

---

## Project File Format

A `.hummed` project is a folder containing:
- `project.json` — MIDI note arrays, instrument selections, BPM, timeline length, drum pad assignments
- `audio/` — drum pad recordings and imported SoundFont files

---

## Drum System

- **Manual mode:** record any sound (up to 3 seconds) and assign to a pad
- **Beatboxing mode:** record up to 4 bars; backend auto-detects and classifies percussive sounds across the full loop and places hits on the drum grid
- 8 pads total
- Auto-detected hits can be reassigned or overridden by the user

---

## Transport & Metronome

- BPM is adjustable at any time and affects grid quantization and beatboxing bar length
- Metronome toggle in top-right corner; generates a click track client-side via Web Audio API during recording
- Both BPM and metronome state are saved with the project

---

## Instrument Support

- **Preset instruments:** Piano, Guitar, Synth, Strings (bundled SoundFonts)
- **Custom import:** user uploads any `.sf2` SoundFont file; max 50MB per file
- FluidSynth handles all synthesis

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No pitch detected (silence/noise) | Returns empty note list; UI shows "No notes detected" |
| Multiple simultaneous pitches | Use dominant frequency only (prototype limitation) |
| Clip too short (<0.5s) | Reject with clear error message |
| MP3 export, ffmpeg missing | Warn user, fall back to WAV-only export |
| SoundFont >50MB | Reject with file size error |

---

## Auto-Save

Projects auto-save every 2 minutes to the `.hummed` project file.

---

## Testing (Prototype)

- **Backend:** pytest unit tests for `/analyze` and `/synthesize` with sample audio files
- **Export:** manually open exported MIDI in GarageBand or another DAW; play exported WAV/MP3 to verify audio quality
- **Frontend:** manual smoke tests — record → analyze → piano roll renders correctly → playback sounds right
- No automated frontend tests for the prototype

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Web Audio API |
| Backend | Python, FastAPI |
| Pitch detection | aubio, librosa |
| MIDI | mido |
| Synthesis | FluidSynth (via pyfluidsynth) |
| Audio export | soundfile, pydub, ffmpeg |
| Project I/O | JSON + local filesystem |

---

## Track Structure (Prototype)

The prototype supports two track types:
- **1 melody track** — voice recording → pitch detection → piano roll (one instrument at a time)
- **1 drum track** — 8-pad grid (manual or beatboxing mode)

Multi-track melody (e.g. stacking a bass line on top of a lead) is out of scope for the prototype.

---

## Out of Scope (Prototype)

- AI-generated accompaniment (drums, bass, chords)
- Cloud save / user accounts
- Real-time pitch monitoring during recording
- Polyphonic chord detection
- Automated frontend tests
