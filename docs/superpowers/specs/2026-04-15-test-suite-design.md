# Hummed Test Suite Design

**Date:** 2026-04-15
**Scope:** Backend API + frontend Zustand store
**Goal:** Pre-deployment confidence before connecting Stripe, Railway, and Vercel

---

## Overview

Two test layers:
1. **Backend** — pytest with httpx async client; heavy services (FluidSynth, librosa) mocked at the service boundary; `/project/*` tested with real file I/O against a temp dir; pure helper functions unit-tested directly.
2. **Frontend** — vitest unit tests for the Zustand store (`projectStore.js`); no React Testing Library needed since the store is framework-agnostic.

---

## Backend Tests

### New dependencies (added to `requirements.txt`)
- `pytest`
- `pytest-asyncio`
- `httpx`

### File layout
```
backend/tests/
├── conftest.py        # async client, sample notes fixture, tmp projects dir
├── test_health.py
├── test_project.py
├── test_analyze.py
├── test_synthesize.py
└── test_export.py
```

### `conftest.py`
- `async_client` fixture: creates an `httpx.AsyncClient` with the FastAPI `app` as transport (no live server needed)
- `sample_notes` fixture: a list of 2 valid note dicts `[{note, start_time, duration, velocity}]`
- Patches `PROJECTS_DIR` in `routers.project` to a `tmp_path` so tests don't pollute `backend/projects/`

### `test_health.py`
- `GET /health` → 200, body `{"status": "ok", "version": "0.1.0"}`

### `test_project.py` (real file I/O)
- `POST /project/save` with valid payload → 200, returns `project_id`
- `GET /project/{id}` → 200, returns saved data matching the payload
- `GET /project/list` → 200, includes the saved project
- `GET /project/nonexistent` → 404

### `test_analyze.py`
**API tests** (mock `routers.analyze.analyze_audio`):
- Valid request with minimal WAV bytes → mock returns 2 notes → 200, `{"notes": [...], "count": 2}`
- Non-audio content-type → 400
- Audio bytes < 1000 bytes → 400

**Unit tests** (import functions directly, no mock):
- `_remove_outliers`: fewer than 4 notes → returned unchanged
- `_remove_outliers`: pitch outlier removed; note with duration < 0.08s removed
- `_merge_close_notes`: same pitch, gap ≤ 0.15s → merged into one note with combined duration
- `_merge_close_notes`: different pitch, small gap → not merged
- `_merge_close_notes`: empty list → empty list returned

### `test_synthesize.py`
Mock `routers.synthesize.synthesize` to return `b"RIFF..."` (fake WAV bytes):
- Valid request (piano, 2 notes) → 200, `content-type: audio/wav`
- Invalid instrument (`"trumpet"`) → 400

### `test_export.py`
Mock `routers.export.synthesize`, `routers.export.export_wav`, `routers.export.export_mp3`, `routers.export.export_midi`:
- `format=wav` → 200, `content-type: audio/wav`, `Content-Disposition: attachment; filename=hummed_export.wav`
- `format=mp3` → 200, `content-type: audio/mpeg`
- `format=midi` → 200, `content-type: audio/midi`

---

## Frontend Store Tests

### New dependencies (added to `package.json` devDependencies)
- `vitest`

### Vitest config
One line added to existing `vite.config.js`:
```js
test: { environment: 'node' }
```

### File
```
frontend/src/store/projectStore.test.js
```

### Test cases

**Initial state**
- Has exactly one track (`Melody`, instrument `piano`)
- `bpm` defaults to 120
- `activeTrackId` matches the default track's id

**Track management**
- `addTrack()` → track count increases by 1, new track becomes active, has empty `notes` array
- `removeTrack(id)` on non-last track → track removed, active switches to remaining track
- `removeTrack(id)` on last track → no-op (can't remove last track)
- `updateTrack(id, {name})` → track name updated
- `toggleMute(id)` → flips `muted` boolean

**Note CRUD**
- `setTrackNotes(trackId, notes)` → replaces all notes for that track
- `updateNote(trackId, 0, {velocity: 100})` → only that note's velocity changes
- `deleteNote(trackId, 0)` → removes note at index 0, remaining notes shift correctly

**Transport**
- `setBpm(140)` → `bpm` becomes 140
- `setPlayheadPosition(2.5)` → `playheadPosition` becomes 2.5
- `setSelectedNoteIndices([0,1])` → `selectedNoteIndices` becomes `[0,1]`

---

## Running the Tests

```bash
# Backend
cd backend && source venv/bin/activate
pip install pytest pytest-asyncio httpx
pytest tests/ -v

# Frontend
cd frontend
npm install --save-dev vitest
npx vitest run
```

---

## What is NOT tested (intentional scope)

- `analyze_audio` internals (librosa/pYIN) — integration tested manually via the Record button
- `synthesize` / FluidSynth internals — tested manually via Playback
- React component rendering — out of scope for this pass
- WebSocket `/ws/playback` — out of scope for this pass
