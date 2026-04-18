# Stripe Pay-Per-Export Design Spec

## Overview

Add a €1.00 pay-per-export gate to VOICEtoMIDI using Stripe Checkout (hosted redirect flow). No user accounts required. Each export triggers a separate Stripe payment. The existing `/export` endpoint is replaced by a verified export endpoint that only serves the file after confirming payment.

---

## User Flow

1. User clicks **Export** button in the Export Panel
2. A format picker appears inline: `WAV · MP3 · MIDI`
3. User picks a format
4. Frontend calls `POST /checkout` with the chosen format
5. Backend creates a Stripe Checkout session (€1.00) and returns `{ session_id, checkout_url }`
6. Frontend saves `{ format, notes, bpm, instrument }` to `localStorage` keyed by `session_id`
7. Frontend redirects the browser to `checkout_url` (Stripe's hosted payment page)
8. User pays on Stripe
9. Stripe redirects to `https://voicetomidi.vercel.app?session_id={CHECKOUT_SESSION_ID}`
10. App detects `session_id` in URL on load, reads saved data from `localStorage`
11. Frontend calls `POST /export/verified` with `{ session_id, format, notes, bpm, instrument }`
12. Backend verifies Stripe session is `paid` and marks it as used
13. Backend generates file and returns it
14. File downloads automatically, `localStorage` entry cleared, URL query params removed

**Cancellation flow:**
- If user cancels on Stripe → Stripe redirects to `https://voicetomidi.vercel.app?export_cancelled=1`
- App detects `export_cancelled=1` on load and reopens the format picker modal automatically

---

## Backend

### New file: `backend/routers/checkout.py`

**`POST /checkout`**
- Input: `{ format: "wav" | "mp3" | "midi" }`
- Creates a Stripe Checkout session:
  - Mode: `payment`
  - Currency: `eur`
  - Amount: `100` (cents = €1.00)
  - Product name: `"VOICEtoMIDI Export – {FORMAT}"`
  - `success_url`: `https://voicetomidi.vercel.app?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url`: `https://voicetomidi.vercel.app?export_cancelled=1`
- Returns: `{ session_id: str, checkout_url: str }`

**`POST /export/verified`**

Lives in `backend/routers/export.py` alongside the existing `/export` route.

- Input: `{ session_id: str, format: str, notes: list, bpm: float, instrument: str }`
- Retrieves the Stripe session via `stripe.checkout.Session.retrieve(session_id)`
- Rejects if `payment_status != "paid"` → 402
- Rejects if `session_id` already in `_used_sessions` set → 409 (already used)
- Adds `session_id` to `_used_sessions`
- Generates and returns the file (same logic as existing `/export`)

**`_used_sessions`** is a module-level `set` in `export.py`. Sufficient for current traffic — lost on server restart, worst case a user gets one duplicate free export. No database needed at this stage.

### Existing `/export` endpoint

Keep it in place — it is used by the backend test suite. Do not remove it.

### New environment variables (Railway)

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` or `sk_test_...`) |

### New dependency

Add `stripe` to `backend/requirements.txt`.

---

## Frontend

### `ExportPanel.jsx` changes

- Remove the three individual WAV / MP3 / MIDI export buttons
- Add a single **Export** button (accent colour, full width of the export row)
- Add `showFormatPicker` state — clicking Export sets it to `true`
- When `showFormatPicker` is true, render three ghost buttons inline: `WAV · MP3 · MIDI`
- Clicking a format button triggers `handleCheckout(fmt)`:
  1. Sets `loading = true`, `status = "Opening checkout…"`
  2. Calls `POST /checkout` via `api/client.js`
  3. Saves `{ format, notes, bpm, instrument }` to `localStorage` as `vtm_pending_export_{session_id}`
  4. Redirects: `window.location.href = checkout_url`

### `api/client.js` changes

Add two new functions:
- `createCheckout(format)` → `POST /checkout`
- `verifiedExport(session_id, format, notes, bpm, instrument)` → `POST /export/verified`

### `App.jsx` changes

Add a `useEffect` on mount that checks `window.location.search`:

- If `?session_id=xxx` is present:
  1. Read `localStorage.getItem('vtm_pending_export_xxx')`
  2. If found: call `verifiedExport(...)`, trigger download, clear localStorage entry, clear URL params
  3. If not found: show error "Export data not found — please try again"

- If `?export_cancelled=1` is present:
  1. Clear URL params
  2. Set a store flag `exportCancelled = true` (or pass via context) so ExportPanel reopens the format picker

### New env var (Vercel)

| Variable | Description |
|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (not used in redirect flow but useful for future) |

---

## Security Notes

- The `session_id` is an opaque Stripe ID — it cannot be guessed
- The backend always re-verifies with Stripe's API before serving the file — the frontend cannot fake a payment
- The `_used_sessions` set prevents replay attacks within a server process lifetime
- Notes data travels in the POST body to `/export/verified` — it is never stored server-side

---

## What Is NOT Included

- No webhooks (`/webhook` endpoint) — not needed for this synchronous verify-then-serve flow
- No user accounts
- No purchase history
- No refund flow (handle manually via Stripe dashboard)
- No free tier or trial exports

---

## Success Criteria

- [ ] Clicking Export → format picker appears
- [ ] Picking a format redirects to Stripe's hosted payment page
- [ ] Paying successfully redirects back and file downloads automatically
- [ ] Cancelling on Stripe redirects back with the format picker open
- [ ] Backend rejects duplicate `session_id` with 409
- [ ] Backend rejects unpaid session with 402
- [ ] Existing `/export` endpoint still works (tests pass)
