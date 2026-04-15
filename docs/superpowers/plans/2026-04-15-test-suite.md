# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-deployment test suite covering backend API endpoints + pure helpers (pytest/httpx) and the frontend Zustand store (vitest).

**Architecture:** Backend tests use httpx's ASGI transport to call FastAPI routes in-process (no live server). Heavy services (FluidSynth, librosa) are mocked at the router import boundary. `/project/*` tests use real file I/O against a `tmp_path`. Frontend tests call Zustand store actions directly — no React rendering needed.

**Tech Stack:** Python — pytest, pytest-asyncio, httpx. JavaScript — vitest.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `backend/pytest.ini` | asyncio_mode = auto |
| Create | `backend/tests/__init__.py` | make tests a package |
| Create | `backend/tests/conftest.py` | shared fixtures |
| Create | `backend/tests/test_health.py` | GET /health |
| Create | `backend/tests/test_project.py` | /project CRUD |
| Create | `backend/tests/test_analyze.py` | /analyze + helper unit tests |
| Create | `backend/tests/test_synthesize.py` | /synthesize |
| Create | `backend/tests/test_export.py` | /export |
| Modify | `backend/requirements.txt` | add pytest, pytest-asyncio, httpx |
| Modify | `frontend/vite.config.js` | add vitest test block |
| Modify | `frontend/package.json` | add test script + vitest dev dep |
| Create | `frontend/src/store/projectStore.test.js` | Zustand store tests |

---

## Task 1: Backend test dependencies + pytest config

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Add test deps to requirements.txt**

Append these three lines to `backend/requirements.txt`:
```
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
```

- [ ] **Step 2: Create pytest.ini**

Create `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 3: Create tests package**

Create `backend/tests/__init__.py` as an empty file.

- [ ] **Step 4: Install deps**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pip install pytest==8.2.0 pytest-asyncio==0.23.6 httpx==0.27.0
```

Expected: all three packages install without error.

- [ ] **Step 5: Verify pytest discovers nothing yet**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest --collect-only
```

Expected: `no tests ran` (0 collected).

- [ ] **Step 6: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/requirements.txt backend/pytest.ini backend/tests/__init__.py
git commit -m "test: add pytest + pytest-asyncio + httpx test infrastructure"
```

---

## Task 2: Shared test fixtures (conftest.py)

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write conftest.py**

Create `backend/tests/conftest.py`:
```python
import pytest
import pytest_asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient, ASGITransport
from main import app
import routers.project as project_router


@pytest_asyncio.fixture
async def async_client(tmp_path, monkeypatch):
    """Async HTTP client wired to the FastAPI app in-process.
    Projects are written to a temp dir so tests don't pollute backend/projects/."""
    monkeypatch.setattr(project_router, "PROJECTS_DIR", str(tmp_path))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def sample_notes():
    return [
        {"note": 60, "start_time": 0.0, "duration": 0.5, "velocity": 80},
        {"note": 64, "start_time": 0.5, "duration": 0.5, "velocity": 90},
    ]
```

- [ ] **Step 2: Verify conftest loads cleanly**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest --collect-only
```

Expected: 0 tests collected, no import errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/conftest.py
git commit -m "test: add shared conftest fixtures (async client, sample notes, tmp projects dir)"
```

---

## Task 3: Health endpoint test

**Files:**
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_health.py`:
```python
import pytest


async def test_health_returns_ok(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"
```

- [ ] **Step 2: Run test — expect it to pass immediately (endpoint already exists)**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_health.py -v
```

Expected: `test_health_returns_ok PASSED`.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_health.py
git commit -m "test: health endpoint"
```

---

## Task 4: Project CRUD tests

**Files:**
- Create: `backend/tests/test_project.py`

- [ ] **Step 1: Write the tests**

Create `backend/tests/test_project.py`:
```python
import pytest


async def test_save_project_returns_project_id(async_client):
    payload = {"name": "My Song", "bpm": 140.0, "instrument": "guitar", "notes": []}
    response = await async_client.post("/project/save", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "project_id" in body
    assert len(body["project_id"]) == 8


async def test_load_project_returns_saved_data(async_client):
    payload = {"name": "My Song", "bpm": 140.0, "instrument": "guitar", "notes": []}
    save_resp = await async_client.post("/project/save", json=payload)
    project_id = save_resp.json()["project_id"]

    load_resp = await async_client.get(f"/project/{project_id}")
    assert load_resp.status_code == 200
    body = load_resp.json()
    assert body["name"] == "My Song"
    assert body["bpm"] == 140.0
    assert body["instrument"] == "guitar"


async def test_list_projects_includes_saved_project(async_client):
    payload = {"name": "Listed Song", "bpm": 120.0, "instrument": "piano", "notes": []}
    save_resp = await async_client.post("/project/save", json=payload)
    project_id = save_resp.json()["project_id"]

    list_resp = await async_client.get("/project/list")
    assert list_resp.status_code == 200
    ids = [p["project_id"] for p in list_resp.json()["projects"]]
    assert project_id in ids


async def test_load_nonexistent_project_returns_404(async_client):
    response = await async_client.get("/project/doesnotexist")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_project.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_project.py
git commit -m "test: project save/load/list/404 endpoints"
```

---

## Task 5: Analyze endpoint tests (API layer, mocked service)

**Files:**
- Create: `backend/tests/test_analyze.py` (API section only — helpers added in Task 6)

- [ ] **Step 1: Write the API tests**

Create `backend/tests/test_analyze.py`:
```python
import pytest
from unittest.mock import patch


async def test_analyze_valid_audio_returns_notes(async_client, sample_notes):
    # > 1000 bytes satisfies the length check; content-type passes the audio check
    fake_audio = b"\x00" * 1200
    with patch("routers.analyze.analyze_audio", return_value=sample_notes):
        response = await async_client.post(
            "/analyze",
            files={"file": ("recording.wav", fake_audio, "audio/wav")},
            data={"bpm": "120.0"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert len(body["notes"]) == 2


async def test_analyze_non_audio_content_type_returns_400(async_client):
    fake_data = b"\x00" * 1200
    response = await async_client.post(
        "/analyze",
        files={"file": ("document.pdf", fake_data, "application/pdf")},
        data={"bpm": "120.0"},
    )
    assert response.status_code == 400
    assert "audio" in response.json()["detail"].lower()


async def test_analyze_short_audio_returns_400(async_client):
    # < 1000 bytes triggers the "too short" check
    short_audio = b"\x00" * 500
    response = await async_client.post(
        "/analyze",
        files={"file": ("short.wav", short_audio, "audio/wav")},
        data={"bpm": "120.0"},
    )
    assert response.status_code == 400
    assert "short" in response.json()["detail"].lower()
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_analyze.py -v
```

Expected: all 3 API tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_analyze.py
git commit -m "test: /analyze API endpoint (mocked service)"
```

---

## Task 6: Audio analyzer helper unit tests

**Files:**
- Modify: `backend/tests/test_analyze.py` (append helper tests)

- [ ] **Step 1: Append unit tests to test_analyze.py**

Append to the bottom of `backend/tests/test_analyze.py`:
```python


# ── Unit tests for pure helper functions ──────────────────────────────────────
from services.audio_analyzer import _remove_outliers, _merge_close_notes


def test_remove_outliers_fewer_than_4_notes_unchanged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
    ]
    assert _remove_outliers(notes) == notes


def test_remove_outliers_removes_pitch_outlier():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
        {"note": 64, "start_time": 0.6, "duration": 0.3, "velocity": 80},
        {"note": 100, "start_time": 0.9, "duration": 0.3, "velocity": 80},  # outlier
    ]
    result = _remove_outliers(notes)
    assert all(n["note"] != 100 for n in result)


def test_remove_outliers_removes_notes_shorter_than_80ms():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
        {"note": 64, "start_time": 0.6, "duration": 0.3, "velocity": 80},
        {"note": 63, "start_time": 0.9, "duration": 0.05, "velocity": 80},  # < 80ms
    ]
    result = _remove_outliers(notes)
    assert all(n["duration"] >= 0.08 for n in result)


def test_merge_close_notes_same_pitch_small_gap_merges():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.4, "velocity": 80},
        # gap = 0.45 - 0.4 = 0.05, which is < 0.15 threshold
        {"note": 60, "start_time": 0.45, "duration": 0.4, "velocity": 90},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 1
    assert result[0]["duration"] == pytest.approx(0.85, abs=0.01)
    assert result[0]["velocity"] == 90  # max of the two


def test_merge_close_notes_different_pitch_not_merged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.4, "velocity": 80},
        {"note": 62, "start_time": 0.45, "duration": 0.4, "velocity": 80},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 2


def test_merge_close_notes_same_pitch_large_gap_not_merged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.1, "velocity": 80},
        # gap = 0.5 - 0.1 = 0.4, which is > 0.15 threshold
        {"note": 60, "start_time": 0.5, "duration": 0.4, "velocity": 80},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 2


def test_merge_close_notes_empty_list():
    assert _merge_close_notes([]) == []
```

- [ ] **Step 2: Run all analyze tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_analyze.py -v
```

Expected: all 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_analyze.py
git commit -m "test: _remove_outliers and _merge_close_notes unit tests"
```

---

## Task 7: Synthesize endpoint tests

**Files:**
- Create: `backend/tests/test_synthesize.py`

- [ ] **Step 1: Write the tests**

Create `backend/tests/test_synthesize.py`:
```python
import pytest
from unittest.mock import patch

FAKE_WAV = b"RIFF" + b"\x00" * 40


async def test_synthesize_valid_returns_wav(async_client, sample_notes):
    with patch("routers.synthesize.synthesize", return_value=FAKE_WAV):
        response = await async_client.post(
            "/synthesize",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"


async def test_synthesize_invalid_instrument_returns_400(async_client, sample_notes):
    response = await async_client.post(
        "/synthesize",
        json={"notes": sample_notes, "instrument": "trumpet", "bpm": 120.0},
    )
    assert response.status_code == 400
    assert "invalid instrument" in response.json()["detail"].lower()
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_synthesize.py -v
```

Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_synthesize.py
git commit -m "test: /synthesize endpoint (valid + invalid instrument)"
```

---

## Task 8: Export endpoint tests

**Files:**
- Create: `backend/tests/test_export.py`

- [ ] **Step 1: Write the tests**

Create `backend/tests/test_export.py`:
```python
import pytest
from unittest.mock import patch

FAKE_WAV = b"RIFF" + b"\x00" * 40
FAKE_MP3 = b"ID3" + b"\x00" * 40
FAKE_MIDI = b"MThd" + b"\x00" * 14


async def test_export_wav(async_client, sample_notes):
    with patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_wav", return_value=FAKE_WAV):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "wav"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert "hummed_export.wav" in response.headers["content-disposition"]


async def test_export_mp3(async_client, sample_notes):
    with patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_mp3", return_value=FAKE_MP3):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "mp3"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert "hummed_export.mp3" in response.headers["content-disposition"]


async def test_export_midi(async_client, sample_notes):
    with patch("routers.export.export_midi", return_value=FAKE_MIDI):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "midi"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/midi"
    assert "hummed_export.mid" in response.headers["content-disposition"]
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_export.py -v
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Run the full backend suite to confirm nothing broken**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest -v
```

Expected: all 17 tests PASS (1 health + 4 project + 9 analyze + 2 synthesize + 3 export).

- [ ] **Step 4: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add backend/tests/test_export.py
git commit -m "test: /export endpoint (WAV, MP3, MIDI)"
```

---

## Task 9: Frontend vitest setup

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/package.json`

- [ ] **Step 1: Install vitest**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend
npm install --save-dev vitest
```

Expected: vitest added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Add test block to vite.config.js**

Replace the contents of `frontend/vite.config.js` with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `frontend/package.json`, add `"test": "vitest run"` to the `"scripts"` block so it reads:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend
npm test
```

Expected: `No test files found` or 0 tests run — no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add frontend/vite.config.js frontend/package.json frontend/package-lock.json
git commit -m "test: add vitest to frontend"
```

---

## Task 10: Zustand store tests

**Files:**
- Create: `frontend/src/store/projectStore.test.js`

- [ ] **Step 1: Write the tests**

Create `frontend/src/store/projectStore.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
import useProjectStore from './projectStore'

const getState = () => useProjectStore.getState()

describe('projectStore', () => {
  beforeEach(() => {
    getState().reset()
  })

  // ── Initial state ────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('has one default Melody track', () => {
      expect(getState().tracks).toHaveLength(1)
      expect(getState().tracks[0].name).toBe('Melody')
      expect(getState().tracks[0].instrument).toBe('piano')
      expect(getState().tracks[0].notes).toEqual([])
    })

    it('bpm defaults to 120', () => {
      expect(getState().bpm).toBe(120)
    })

    it('activeTrackId matches the default track id', () => {
      expect(getState().activeTrackId).toBe(getState().tracks[0].id)
    })
  })

  // ── Track management ─────────────────────────────────────────────────────
  describe('track management', () => {
    it('addTrack increases track count by 1 and sets new track active', () => {
      getState().addTrack()
      expect(getState().tracks).toHaveLength(2)
      const newTrack = getState().tracks[1]
      expect(getState().activeTrackId).toBe(newTrack.id)
      expect(newTrack.notes).toEqual([])
    })

    it('removeTrack removes the track and switches active to the remaining track', () => {
      getState().addTrack()
      const [first, second] = getState().tracks
      getState().removeTrack(second.id)
      expect(getState().tracks).toHaveLength(1)
      expect(getState().activeTrackId).toBe(first.id)
    })

    it('removeTrack is a no-op when only one track remains', () => {
      const [only] = getState().tracks
      getState().removeTrack(only.id)
      expect(getState().tracks).toHaveLength(1)
    })

    it('updateTrack changes the track name', () => {
      const [track] = getState().tracks
      getState().updateTrack(track.id, { name: 'Renamed' })
      expect(getState().tracks[0].name).toBe('Renamed')
    })

    it('toggleMute flips the muted boolean', () => {
      const [track] = getState().tracks
      expect(getState().tracks[0].muted).toBe(false)
      getState().toggleMute(track.id)
      expect(getState().tracks[0].muted).toBe(true)
      getState().toggleMute(track.id)
      expect(getState().tracks[0].muted).toBe(false)
    })
  })

  // ── Note CRUD ────────────────────────────────────────────────────────────
  describe('note CRUD', () => {
    const NOTE_A = { note: 60, start_time: 0.0, duration: 0.5, velocity: 80 }
    const NOTE_B = { note: 64, start_time: 0.5, duration: 0.5, velocity: 90 }

    it('setTrackNotes replaces all notes for a track', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      expect(getState().tracks[0].notes).toEqual([NOTE_A, NOTE_B])
    })

    it('updateNote mutates only the specified note field, leaving others unchanged', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      getState().updateNote(track.id, 0, { velocity: 100 })
      expect(getState().tracks[0].notes[0].velocity).toBe(100)
      expect(getState().tracks[0].notes[1].velocity).toBe(90) // unchanged
    })

    it('deleteNote removes note at index 0 and shifts remaining notes', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      getState().deleteNote(track.id, 0)
      expect(getState().tracks[0].notes).toHaveLength(1)
      expect(getState().tracks[0].notes[0]).toEqual(NOTE_B)
    })
  })

  // ── Transport ────────────────────────────────────────────────────────────
  describe('transport', () => {
    it('setBpm updates bpm', () => {
      getState().setBpm(140)
      expect(getState().bpm).toBe(140)
    })

    it('setPlayheadPosition updates playheadPosition', () => {
      getState().setPlayheadPosition(2.5)
      expect(getState().playheadPosition).toBe(2.5)
    })

    it('setSelectedNoteIndices updates selectedNoteIndices', () => {
      getState().setSelectedNoteIndices([0, 1])
      expect(getState().selectedNoteIndices).toEqual([0, 1])
    })
  })
})
```

- [ ] **Step 2: Run the frontend tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend
npm test
```

Expected: all 14 tests PASS across 5 describe blocks.

- [ ] **Step 3: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add frontend/src/store/projectStore.test.js
git commit -m "test: Zustand projectStore — initial state, track CRUD, note CRUD, transport"
```

---

## Final verification

- [ ] **Run the complete backend suite**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest -v
```

Expected: **17 tests PASS**, 0 failures.

- [ ] **Run the complete frontend suite**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend
npm test
```

Expected: **14 tests PASS**, 0 failures.
