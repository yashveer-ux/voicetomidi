# Stripe Pay-Per-Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every file export behind a €1.00 Stripe Checkout payment, with a single Export button and inline format picker.

**Architecture:** Backend gets two new endpoints — `POST /checkout` (creates Stripe session) and `POST /export/verified` (verifies payment then serves file). Frontend saves pending export data to `localStorage` before redirecting to Stripe, reads it back on return, and triggers the download. App.jsx handles URL params on mount for both success and cancel cases.

**Tech Stack:** Python `stripe` library (backend), Stripe Checkout hosted redirect (no Stripe.js needed), React `useState`/`useEffect`, `localStorage`, `window.history.replaceState`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/requirements.txt` | Modify | Add `stripe` dependency |
| `backend/routers/checkout.py` | Create | `POST /checkout` — create Stripe session |
| `backend/routers/export.py` | Modify | Add `POST /export/verified` + `_used_sessions` set |
| `backend/main.py` | Modify | Register checkout router |
| `backend/tests/test_checkout.py` | Create | Tests for `/checkout` and `/export/verified` |
| `frontend/src/api/client.js` | Modify | Add `createCheckout`, `verifiedExport` functions |
| `frontend/src/components/ExportPanel.jsx` | Modify | Single Export button + inline format picker + checkout flow |
| `frontend/src/App.jsx` | Modify | On-mount URL param handler for session_id / export_cancelled |

---

### Task 1: Add stripe to backend dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add stripe to requirements.txt**

Add `stripe==10.4.0` to `backend/requirements.txt`. The file should look like:

```
fastapi==0.128.8
uvicorn[standard]==0.29.0
python-multipart==0.0.20
numpy==1.26.4
librosa==0.10.2
soundfile==0.12.1
mido==1.3.2
pydub==0.25.1
pyfluidsynth==1.3.3
websockets==12.0
pytest==8.4.2
pytest-asyncio==0.23.6
httpx==0.27.0
stripe==10.4.0
```

- [ ] **Step 2: Install in the venv**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pip install stripe==10.4.0
```

Expected: `Successfully installed stripe-10.4.0`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat: add stripe dependency"
```

---

### Task 2: Create POST /checkout endpoint

**Files:**
- Create: `backend/routers/checkout.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_checkout.py`:

```python
import pytest
from unittest.mock import patch, MagicMock


async def test_create_checkout_session(async_client):
    fake_session = MagicMock()
    fake_session.id = "cs_test_abc123"
    fake_session.url = "https://checkout.stripe.com/pay/cs_test_abc123"

    with patch("routers.checkout.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = fake_session
        response = await async_client.post(
            "/checkout", json={"format": "wav"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "cs_test_abc123"
    assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_abc123"


async def test_create_checkout_invalid_format(async_client):
    response = await async_client.post(
        "/checkout", json={"format": "ogg"}
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_checkout.py -v 2>&1 | tail -15
```

Expected: FAIL — `404` or import error (router doesn't exist yet)

- [ ] **Step 3: Create `backend/routers/checkout.py`**

```python
import os
import stripe
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")

router = APIRouter()


class CheckoutRequest(BaseModel):
    format: Literal["wav", "mp3", "midi"]


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": 100,  # €1.00 in cents
                "product_data": {
                    "name": f"VOICEtoMIDI Export – {req.format.upper()}",
                },
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{FRONTEND_URL}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}?export_cancelled=1",
    )

    return {"session_id": session.id, "checkout_url": session.url}
```

- [ ] **Step 4: Register the checkout router in `backend/main.py`**

Add the import and `include_router` call. Change:

```python
from routers.analyze import router as analyze_router
from routers.synthesize import router as synthesize_router
from routers.export import router as export_router
from routers.project import router as project_router
```
to:
```python
from routers.analyze import router as analyze_router
from routers.synthesize import router as synthesize_router
from routers.export import router as export_router
from routers.project import router as project_router
from routers.checkout import router as checkout_router
```

And add after the other `include_router` calls:
```python
app.include_router(checkout_router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_checkout.py::test_create_checkout_session tests/test_checkout.py::test_create_checkout_invalid_format -v
```

Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add backend/routers/checkout.py backend/main.py backend/tests/test_checkout.py
git commit -m "feat: POST /checkout — create Stripe Checkout session"
```

---

### Task 3: Add POST /export/verified endpoint

**Files:**
- Modify: `backend/routers/export.py`
- Modify: `backend/tests/test_checkout.py`

- [ ] **Step 1: Write failing tests for /export/verified**

Add to the bottom of `backend/tests/test_checkout.py`:

```python
import routers.export as export_router_module


async def test_verified_export_wav(async_client, sample_notes):
    export_router_module._used_sessions.clear()

    fake_session = MagicMock()
    fake_session.payment_status = "paid"

    FAKE_WAV = b"RIFF" + b"\x00" * 40

    with patch("routers.export.stripe") as mock_stripe, \
         patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_wav", return_value=FAKE_WAV):
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_wav",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"


async def test_verified_export_duplicate_session(async_client, sample_notes):
    export_router_module._used_sessions.clear()
    export_router_module._used_sessions.add("cs_test_dup")

    fake_session = MagicMock()
    fake_session.payment_status = "paid"

    with patch("routers.export.stripe") as mock_stripe:
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_dup",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 409


async def test_verified_export_unpaid(async_client, sample_notes):
    export_router_module._used_sessions.clear()

    fake_session = MagicMock()
    fake_session.payment_status = "unpaid"

    with patch("routers.export.stripe") as mock_stripe:
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_unpaid",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 402
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_checkout.py::test_verified_export_wav tests/test_checkout.py::test_verified_export_duplicate_session tests/test_checkout.py::test_verified_export_unpaid -v 2>&1 | tail -15
```

Expected: all FAIL — `404 Not Found`

- [ ] **Step 3: Add `_used_sessions`, stripe import, and `/export/verified` to `backend/routers/export.py`**

Add these imports and module-level set at the top of the file (after existing imports):

```python
import os
import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

_used_sessions: set = set()
```

Add this model and endpoint at the bottom of `backend/routers/export.py` (after the existing `/export` route):

```python
class VerifiedExportRequest(BaseModel):
    session_id: str
    format: str  # "wav" | "mp3" | "midi"
    notes: List[Note] = []
    instrument: str = "piano"
    bpm: float = 120.0


@router.post("/export/verified")
async def export_verified(req: VerifiedExportRequest):
    # Verify payment with Stripe
    session = stripe.checkout.Session.retrieve(req.session_id)
    if session.payment_status != "paid":
        raise HTTPException(status_code=402, detail="Payment required")

    # Prevent replay
    if req.session_id in _used_sessions:
        raise HTTPException(status_code=409, detail="Session already used")
    _used_sessions.add(req.session_id)

    # Generate file (same logic as /export)
    notes_dicts = [n.model_dump() for n in req.notes]

    if req.format == "midi":
        midi_bytes = export_midi(notes_dicts, [], bpm=req.bpm)
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": f"attachment; filename=export.mid"},
        )

    wav_bytes = synthesize(notes_dicts, instrument=req.instrument, bpm=req.bpm)

    if req.format == "mp3":
        mp3_bytes = export_mp3(wav_bytes, b"")
        if mp3_bytes is None:
            raise HTTPException(
                status_code=422,
                detail="MP3 export requires ffmpeg.",
            )
        return Response(
            content=mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=export.mp3"},
        )

    wav_out = export_wav(wav_bytes, b"")
    return Response(
        content=wav_out,
        media_type="audio/wav",
        headers={"Content-Disposition": f"attachment; filename=export.wav"},
    )
```

- [ ] **Step 4: Run all new tests**

```bash
cd /Users/yashveersookun/Desktop/Hummed/backend
source venv/bin/activate
pytest tests/test_checkout.py -v
```

Expected: all 5 tests PASS

- [ ] **Step 5: Run full test suite to verify nothing broke**

```bash
pytest -v 2>&1 | tail -20
```

Expected: all tests PASS (existing export/health/project/analyze/synthesize tests unchanged)

- [ ] **Step 6: Commit**

```bash
git add backend/routers/export.py backend/tests/test_checkout.py
git commit -m "feat: POST /export/verified — verify Stripe payment then serve file"
```

---

### Task 4: Frontend API client functions

**Files:**
- Modify: `frontend/src/api/client.js`

- [ ] **Step 1: Add `createCheckout` and `verifiedExport` to `frontend/src/api/client.js`**

Append these two functions at the bottom of the file:

```js
// Create a Stripe Checkout session for a paid export
export async function createCheckout(format) {
  const res = await post('/checkout', { format })
  return res.json() // { session_id, checkout_url }
}

// Verify a paid Stripe session and download the exported file
export async function verifiedExport(sessionId, format, notes, bpm, instrument) {
  const res = await post('/export/verified', {
    session_id: sessionId,
    format,
    notes,
    bpm,
    instrument,
  })
  return res.blob()
}
```

- [ ] **Step 2: Verify the file looks correct**

```bash
tail -15 /Users/yashveersookun/Desktop/Hummed/frontend/src/api/client.js
```

Expected: the two new exported functions appear at the end.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.js
git commit -m "feat: add createCheckout and verifiedExport to API client"
```

---

### Task 5: ExportPanel — single Export button with format picker

**Files:**
- Modify: `frontend/src/components/ExportPanel.jsx`

**Context:** The current panel has three individual buttons (WAV, MP3, MIDI) that call `/export` directly. Replace them with a single **Export** button. Clicking it shows an inline format picker. Picking a format triggers the Stripe checkout flow.

The component receives one new prop: `autoOpenPicker` (boolean). When `true`, the format picker opens automatically on mount (used when the user cancelled out of Stripe and came back).

- [ ] **Step 1: Update ExportPanel.jsx**

Replace the full file contents with:

```jsx
import { useState, useEffect } from 'react'
import { createCheckout, saveProject, listProjects, loadProject } from '../api/client'
import useProjectStore from '../store/projectStore'

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}

export default function ExportPanel({ autoOpenPicker = false, onExportDownloaded }) {
  const { tracks, bpm, projectName, setProjectName, setProjectId, reset } = useProjectStore()
  const notes = tracks.flatMap(t => t.notes)
  const instrument = tracks.find(t => t.type === 'instrument')?.instrument || 'piano'

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState([])
  const [showLoad, setShowLoad] = useState(false)
  const [showFormatPicker, setShowFormatPicker] = useState(false)

  // Auto-open picker when returning from a cancelled Stripe session
  useEffect(() => {
    if (autoOpenPicker) setShowFormatPicker(true)
  }, [autoOpenPicker])

  const handleCheckout = async (fmt) => {
    setLoading(true)
    setShowFormatPicker(false)
    setStatus('Opening checkout…')
    try {
      const { session_id, checkout_url } = await createCheckout(fmt)
      // Save pending export data so we can retrieve it after the redirect
      localStorage.setItem(
        `vtm_pending_export_${session_id}`,
        JSON.stringify({ format: fmt, notes, bpm, instrument, projectName })
      )
      window.location.href = checkout_url
    } catch (e) {
      setStatus(`Error: ${e.message}`)
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const r = await saveProject({ name: projectName, bpm, instrument, notes })
      setProjectId(r.project_id)
      setStatus('✓ Saved')
    } catch (e) { setStatus(`Error: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleLoad = async (pid) => {
    const data = await loadProject(pid)
    useProjectStore.setState({
      instrument: data.instrument || 'piano', bpm: data.bpm || 120,
      projectName: data.name || 'Untitled', projectId: pid,
    })
    setShowLoad(false)
    setStatus(`✓ Loaded "${data.name}"`)
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>PROJECT</span>
      </div>

      <div style={s.row}>
        <input
          type="text" value={projectName}
          onChange={e => setProjectName(e.target.value)}
          style={s.nameInput} placeholder="Project name"
        />
      </div>

      <div style={s.row}>
        <button style={s.btn} onClick={handleSave} disabled={loading}>Save</button>
        <button style={s.btnGhost} onClick={async () => { const r = await listProjects(); setProjects(r.projects); setShowLoad(true) }}>Load</button>
        <button style={s.btnGhost} onClick={reset}>New</button>
      </div>

      <div style={s.divider} />
      <span style={s.exportLabel}>EXPORT</span>

      {!showFormatPicker ? (
        <div style={s.row}>
          <button
            style={s.exportMainBtn}
            onClick={() => setShowFormatPicker(true)}
            disabled={loading || notes.length === 0}
          >
            ↓ Export  ·  €1.00
          </button>
        </div>
      ) : (
        <div style={s.row}>
          {['wav', 'mp3', 'midi'].map(fmt => (
            <button
              key={fmt}
              style={s.exportBtn}
              onClick={() => handleCheckout(fmt)}
              disabled={loading}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
          <button style={s.cancelBtn} onClick={() => setShowFormatPicker(false)}>✕</button>
        </div>
      )}

      {status && (
        <p style={{ ...s.status, color: status.startsWith('✓') ? 'var(--teal)' : '#e74c3c' }}>
          {status}
        </p>
      )}

      {showLoad && (
        <div style={s.modal}>
          <p style={s.modalTitle}>Saved Projects</p>
          {projects.length === 0 && <p style={s.modalEmpty}>No saved projects</p>}
          {projects.map(p => (
            <div key={p.project_id} style={s.projectRow} onClick={() => handleLoad(p.project_id)}>
              <span style={s.projectName}>{p.name}</span>
              <span style={s.projectId}>#{p.project_id}</span>
            </div>
          ))}
          <button style={s.btnGhost} onClick={() => setShowLoad(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    background: '#f0eeea', border: '1px solid #c8c6c2',
    borderRadius: 'var(--radius-lg)', padding: '12px 14px',
    color: '#3a3a38',
  },
  header: { marginBottom: 10 },
  title: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#888684', letterSpacing: 1, textTransform: 'uppercase' },
  row: { display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  nameInput: {
    flex: 1, background: '#e4e2de', border: '1px solid #c8c6c2',
    borderRadius: 'var(--radius)', color: '#3a3a38', padding: '6px 10px',
    fontSize: 12, fontFamily: 'var(--font-ui)',
  },
  btn: {
    background: 'var(--teal)', color: '#000', border: 'none',
    borderRadius: 'var(--radius)', padding: '6px 14px',
    fontWeight: 700, fontSize: 11, boxShadow: '0 0 8px var(--teal-glow)',
  },
  btnGhost: {
    background: '#e4e2de', color: '#686664',
    border: '1px solid #c8c6c2', borderRadius: 'var(--radius)',
    padding: '6px 12px', fontWeight: 600, fontSize: 11,
  },
  divider: { height: 1, background: '#c8c6c2', margin: '8px 0' },
  exportLabel: { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888684', letterSpacing: 1.5, marginBottom: 8 },
  exportMainBtn: {
    flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius)', padding: '8px 14px',
    fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)',
    boxShadow: '0 0 10px var(--accent-glow)', letterSpacing: 0.5,
  },
  exportBtn: {
    background: '#e4e2de', color: 'var(--purple)',
    border: '1px solid #c8c6c2', borderRadius: 'var(--radius)',
    padding: '6px 14px', fontWeight: 700, fontSize: 11,
    fontFamily: 'var(--font-mono)', letterSpacing: 1,
  },
  cancelBtn: {
    background: 'transparent', color: '#888684',
    border: '1px solid #c8c6c2', borderRadius: 'var(--radius)',
    padding: '6px 10px', fontSize: 11,
  },
  status: { fontSize: 11, marginTop: 6, fontFamily: 'var(--font-mono)' },
  modal: { background: '#e4e2de', border: '1px solid #c8c6c2', borderRadius: 'var(--radius)', padding: 10, marginTop: 8 },
  modalTitle: { fontFamily: 'var(--font-mono)', fontSize: 10, color: '#686664', marginBottom: 8 },
  modalEmpty: { fontSize: 11, color: '#888684' },
  projectRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius)',
    background: '#d8d6d2', marginBottom: 4,
  },
  projectName: { fontSize: 12, color: '#3a3a38' },
  projectId: { fontSize: 10, color: '#888684', fontFamily: 'var(--font-mono)' },
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend && npm run build 2>&1 | tail -8
```

Expected: `✓ built in`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExportPanel.jsx
git commit -m "feat: replace 3 export buttons with single Export button + format picker + Stripe checkout"
```

---

### Task 6: App.jsx — handle Stripe return URL params on mount

**Files:**
- Modify: `frontend/src/App.jsx`

**Context:** After a successful Stripe payment, the user lands back at `?session_id=xxx`. After cancellation, they land at `?export_cancelled=1`. App.jsx detects these on mount, handles the download or reopens the format picker, then cleans up the URL.

- [ ] **Step 1: Add import for verifiedExport to App.jsx**

At the top of `frontend/src/App.jsx`, the existing imports are:
```js
import { useState, useRef, useEffect, useCallback } from 'react'
```
and other component imports. Add the API import:
```js
import { verifiedExport } from './api/client'
```

- [ ] **Step 2: Add exportCancelled state and on-mount useEffect to App.jsx**

Inside the `App` component function, after the existing state declarations (`backendStatus`, `isLooping`, `loopBars`), add:

```js
const [exportCancelled, setExportCancelled] = useState(false)
```

Then add a new `useEffect` (place it after the existing backend health-check `useEffect`):

```js
// Handle Stripe return — success or cancel
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('session_id')
  const cancelled = params.get('export_cancelled')

  // Clean up URL immediately regardless of outcome
  window.history.replaceState({}, '', '/')

  if (sessionId) {
    const key = `vtm_pending_export_${sessionId}`
    const raw = localStorage.getItem(key)
    if (!raw) return
    const { format, notes, bpm, instrument, projectName } = JSON.parse(raw)
    localStorage.removeItem(key)

    verifiedExport(sessionId, format, notes, bpm, instrument)
      .then(blob => {
        const ext = format === 'midi' ? 'mid' : format
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${projectName || 'export'}.${ext}`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(err => console.error('Export failed after payment:', err))
  }

  if (cancelled) {
    setExportCancelled(true)
    // Reset flag after a tick so ExportPanel can re-read it on re-render
    setTimeout(() => setExportCancelled(false), 100)
  }
}, []) // runs once on mount
```

- [ ] **Step 3: Pass exportCancelled prop to ExportPanel**

In the JSX return block, find:
```jsx
<ExportPanel />
```
Change to:
```jsx
<ExportPanel autoOpenPicker={exportCancelled} />
```

- [ ] **Step 4: Build to verify no errors**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend && npm run build 2>&1 | tail -8
```

Expected: `✓ built in`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: handle Stripe return URL — trigger download on success, reopen picker on cancel"
```

---

### Task 7: Set environment variables and deploy

**Files:** None (configuration only)

- [ ] **Step 1: Set STRIPE_SECRET_KEY on Railway**

In the Railway dashboard for the VOICEtoMIDI backend service:
- Go to **Variables** tab
- Add: `STRIPE_SECRET_KEY` = your Stripe secret key (`sk_test_...` for testing, `sk_live_...` for production)
- Add: `FRONTEND_URL` = `https://voicetomidi.vercel.app`

Railway will redeploy automatically.

- [ ] **Step 2: Verify Railway is healthy after redeploy**

```bash
curl https://voicetomidi-production.up.railway.app/health
```

Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 3: Deploy frontend to Vercel**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend
vercel --prod
```

Expected: `✓ Production: https://voicetomidi.vercel.app`

- [ ] **Step 4: End-to-end smoke test (use Stripe test mode)**

1. Open https://voicetomidi.vercel.app
2. Add a note to the piano roll
3. Click **Export · €1.00**
4. Pick **WAV**
5. Stripe Checkout opens — use test card `4242 4242 4242 4242`, any future expiry, any CVC
6. Confirm payment
7. App reopens → WAV file downloads automatically
8. Try again with the same session — should NOT download again (session already used)

- [ ] **Step 5: Test cancellation**

1. Click **Export · €1.00** → pick **MP3**
2. On Stripe page, click **Back** / cancel
3. App reopens with format picker already open

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Single Export button | Task 5 |
| Format picker (WAV/MP3/MIDI) | Task 5 |
| POST /checkout creates Stripe session (€1.00, EUR) | Task 2 |
| success_url with `{CHECKOUT_SESSION_ID}` | Task 2 |
| cancel_url with `export_cancelled=1` | Task 2 |
| Frontend saves pending data to localStorage | Task 5 |
| Frontend redirects to checkout_url | Task 5 |
| POST /export/verified verifies payment | Task 3 |
| 402 on unpaid session | Task 3 |
| 409 on duplicate session | Task 3 |
| `_used_sessions` prevents replay | Task 3 |
| App.jsx detects session_id on mount | Task 6 |
| App.jsx detects export_cancelled on mount | Task 6 |
| URL cleaned with replaceState | Task 6 |
| Existing `/export` endpoint preserved | Not modified — ✅ |
| STRIPE_SECRET_KEY env var | Task 7 |
| FRONTEND_URL env var | Task 7 |

All spec requirements covered. ✅
