# Mobile Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make VOICEtoMIDI usable on phones (≤768px) via a vertical-scroll single-column layout with full touch support on the Piano Roll canvas.

**Architecture:** CSS class names are added to the key layout containers. `index.css` uses `@media (max-width: 768px)` to flip flex direction, allow scrolling, fix fixed widths, and reorder sections with `order`. Touch events are added to the PianoRoll canvas via `addEventListener({ passive: false })` so we can `preventDefault()` on pinch. PPS becomes a `useRef` so pinch-zoom updates it without a React re-render.

**Tech Stack:** React 18, Vite, vanilla CSS, HTML Canvas touch events

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add `@media (max-width: 768px)` block |
| `frontend/src/App.jsx` | Add `className` props to body, center, right; wrap TrackList in a div |
| `frontend/src/components/TrackList.jsx` | Add `className="track-list-inner"` to the `s.wrap` div |
| `frontend/src/components/PianoRoll.jsx` | Add touch handlers; make PPS a zoom ref |

---

## Mobile stack order (spec requirement)

On desktop the DOM order is: `TrackList | center(ArrangementView + PianoRoll + controls) | ExportPanel`.

On mobile we need: `center → TrackList → ExportPanel` (Transport is already pinned above the body).

We achieve this with CSS `order`:
- `.app-center` → `order: 1`
- `.track-panel` wrapper → `order: 2`
- `.export-panel` → `order: 3`

No DOM reordering needed.

---

### Task 1: Mobile layout — CSS and class names

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/TrackList.jsx`

**Context:**
- `index.css` has `overflow: hidden; height: 100%` on `html, body, #root` — must be overridden on mobile or the page won't scroll.
- `App.jsx` inline style `s.app` has `height: '100vh'` — overridden via class on mobile.
- `App.jsx` inline style `s.body` has `display: flex` (row) and `overflow: hidden` — overridden to column + visible on mobile.
- `TrackList.jsx` has `width: 200` inline on its outer div — overridden via a class on mobile.
- The `s.right` (ExportPanel) div has `width: 240` inline — overridden to 100% on mobile.

- [ ] **Step 1: Append mobile media query block to `frontend/src/index.css`**

Open `frontend/src/index.css` and append this block at the very end:

```css
/* ── Mobile layout (≤768px) ────────────────────────────────────────────── */
@media (max-width: 768px) {
  html, body, #root {
    height: auto;
    min-height: 100%;
    overflow: auto;
  }

  /* App shell */
  .app-root {
    height: auto !important;
    min-height: 100vh;
  }

  /* Body: switch from 3-column row to single-column stack */
  .app-body {
    flex-direction: column !important;
    overflow: visible !important;
  }

  /* Reorder sections: Piano Roll area first, then Tracks, then Export */
  .app-center  { order: 1; }
  .track-panel { order: 2; }
  .export-panel { order: 3; }

  /* TrackList: full width, remove right border */
  .track-panel {
    width: 100% !important;
  }
  .track-list-inner {
    width: 100% !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border);
  }

  /* ExportPanel: full width, remove left border */
  .export-panel {
    width: 100% !important;
    border-left: none !important;
    border-top: 1px solid var(--border);
  }
}
```

- [ ] **Step 2: Verify CSS was appended**

```bash
tail -30 /Users/yashveersookun/Desktop/Hummed/frontend/src/index.css
```
Expected: the `@media (max-width: 768px)` block is present.

- [ ] **Step 3: Add class names in `App.jsx`**

In `frontend/src/App.jsx`, make these three targeted edits to the JSX return block:

**3a.** Change the app root div:
```jsx
    <div style={s.app}>
```
→
```jsx
    <div style={s.app} className="app-root">
```

**3b.** Change the body div:
```jsx
      <div style={s.body}>
```
→
```jsx
      <div style={s.body} className="app-body">
```

**3c.** Wrap TrackList in a container div and add className to the center and right divs:
```jsx
        {/* Track List */}
        <TrackList onPlayTrack={handlePlayTrack} />

        {/* Center: Roll + controls */}
        <div style={s.center}>
```
→
```jsx
        {/* Track List */}
        <div className="track-panel">
          <TrackList onPlayTrack={handlePlayTrack} />
        </div>

        {/* Center: Roll + controls */}
        <div style={s.center} className="app-center">
```

**3d.** Change the right panel div:
```jsx
        <div style={s.right}>
```
→
```jsx
        <div style={s.right} className="export-panel">
```

- [ ] **Step 4: Add className to TrackList's wrap div**

In `frontend/src/components/TrackList.jsx`, change the outermost return div:
```jsx
    <div style={s.wrap}>
```
→
```jsx
    <div style={s.wrap} className="track-list-inner">
```

- [ ] **Step 5: Build to verify no errors**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend && npm run build 2>&1 | tail -10
```
Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add frontend/src/index.css frontend/src/App.jsx frontend/src/components/TrackList.jsx
git commit -m "feat: mobile layout — vertical scroll, reordered sections, media queries"
```

---

### Task 2: Piano Roll touch support

**Files:**
- Modify: `frontend/src/components/PianoRoll.jsx`

**Context:**
- `PPS = 120` is a module-level constant used in `hitTest`, `draw`, `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, and `notesInRect`. We'll rename it to `PPS_BASE = 120` and introduce a `ppsRef = useRef(PPS_BASE)` inside the component. All internal uses of `PPS` become `ppsRef.current`.
- `hitTest(notes, x, y)` is a module-level function. We change it to `hitTest(notes, x, y, pps)`.
- Touch events: single-finger scroll is handled by the browser (we do NOT intercept it). We only prevent default on two-finger (pinch) touchmove. Long-press (500ms) deletes a note. Short tap (< 200ms, < 10px movement) on empty space adds a note.
- `{ passive: false }` is required on `touchstart` and `touchmove` so we can call `preventDefault()` on pinch.
- `touchAction: 'manipulation'` on the canvas style: tells browser we handle gestures ourselves (disables double-tap zoom), while still allowing single-finger scroll to propagate.

- [ ] **Step 1: Rename PPS constant and add ppsRef**

At the top of `frontend/src/components/PianoRoll.jsx`, change:
```js
const PPS = 120
```
to:
```js
const PPS_BASE = 120
```

Inside the `PianoRoll` component function, after the `clipboardRef` line, add:
```js
const ppsRef = useRef(PPS_BASE)
```

- [ ] **Step 2: Update hitTest signature to accept pps**

Replace the module-level `hitTest` function:
```js
function hitTest(notes, x, y, pps) {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    const nx = n.start_time * pps, nw = Math.max(n.duration * pps, 6)
    const ny = (MIDI_MAX - n.note) * PIANO_ROW_H
    if (x >= nx && x <= nx + nw && y >= ny && y < ny + PIANO_ROW_H) {
      return { index: i, zone: x >= nx + nw - RESIZE_PX ? 'resize' : 'move' }
    }
  }
  return null
}
```

- [ ] **Step 3: Replace PPS with ppsRef.current inside draw()**

In the `draw` useCallback, make these replacements (the draw function uses PPS in 4 places):

```js
// Line: canvas width calculation
const W = Math.max(900, maxTime * ppsRef.current + 60)

// Line: note x position
const x = note.start_time * ppsRef.current

// Line: note width
const w = Math.max(note.duration * ppsRef.current, 6)

// Line: playhead x
const playX = playheadPosition * ppsRef.current
```

- [ ] **Step 4: Replace PPS with ppsRef.current in notesInRect**

Replace the `notesInRect` function inside the component:
```js
const notesInRect = (notes, m) => {
  const x1 = Math.min(m.sx, m.ex), x2 = Math.max(m.sx, m.ex)
  const y1 = Math.min(m.sy, m.ey), y2 = Math.max(m.sy, m.ey)
  const found = new Set()
  notes.forEach((n, i) => {
    const nx = n.start_time * ppsRef.current, nw = Math.max(n.duration * ppsRef.current, 6)
    const ny = (MIDI_MAX - n.note) * PIANO_ROW_H
    if (nx < x2 && nx + nw > x1 && ny < y2 && ny + PIANO_ROW_H > y1) found.add(i)
  })
  return found
}
```

- [ ] **Step 5: Replace PPS with ppsRef.current in mouse handlers**

In `handleMouseDown`:
- `hitTest(activeTrack.notes, x, y)` → `hitTest(activeTrack.notes, x, y, ppsRef.current)`

In `handleMouseMove`:
- `hitTest(activeTrack.notes, x, y)` → `hitTest(activeTrack.notes, x, y, ppsRef.current)`
- `const dTime = dx / PPS` → `const dTime = dx / ppsRef.current`

In `handleMouseUp`:
- `hitTest(activeTrack.notes, x, y)` (inside notesInRect call is already handled above)
- `const snapped = Math.round((m.sx / PPS) / snapUnit) * snapUnit` → `const snapped = Math.round((m.sx / ppsRef.current) / snapUnit) * snapUnit`

- [ ] **Step 6: Add touchPos helper**

After the `canvasPos` function definition (around line 154), add:
```js
const touchPos = (touch) => {
  const r = canvasRef.current.getBoundingClientRect()
  return { x: touch.clientX - r.left, y: touch.clientY - r.top }
}
```

- [ ] **Step 7: Add touch event useEffect**

After the `useEffect` that attaches `mousemove`/`mouseup` to window (the one ending with `return () => { window.removeEventListener... }`), add this new useEffect:

```js
// ── Touch handlers ─────────────────────────────────────────────────────────
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  let tapStart = null       // { x, y, time }
  let longPressTimer = null
  let pinchStart = null     // { dist, pps }

  const pinchDist = (e) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      clearTimeout(longPressTimer)
      tapStart = null
      pinchStart = { dist: pinchDist(e), pps: ppsRef.current }
      return
    }
    if (e.touches.length === 1) {
      const pos = touchPos(e.touches[0])
      tapStart = { x: pos.x, y: pos.y, time: Date.now() }
      longPressTimer = setTimeout(() => {
        const hit = hitTest(activeTrack.notes, pos.x, pos.y, ppsRef.current)
        if (hit) {
          if (selectedRef.current.has(hit.index) && selectedRef.current.size > 1) {
            setTrackNotes(activeTrackId, activeTrack.notes.filter((_, i) => !selectedRef.current.has(i)))
          } else {
            deleteNote(activeTrackId, hit.index)
          }
          syncSelection(new Set())
          draw()
        }
        tapStart = null
      }, 500)
    }
  }

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault()
      const ratio = pinchDist(e) / pinchStart.dist
      ppsRef.current = Math.max(40, Math.min(400, Math.round(pinchStart.pps * ratio)))
      draw()
      return
    }
    if (e.touches.length === 1 && tapStart) {
      const pos = touchPos(e.touches[0])
      const moved = Math.abs(pos.x - tapStart.x) + Math.abs(pos.y - tapStart.y)
      if (moved > 10) {
        clearTimeout(longPressTimer)
        tapStart = null  // finger is scrolling; cancel tap/long-press
      }
    }
  }

  const onTouchEnd = (e) => {
    clearTimeout(longPressTimer)
    if (tapStart && e.touches.length === 0) {
      const elapsed = Date.now() - tapStart.time
      if (elapsed < 200) {
        const { x, y } = tapStart
        const hit = hitTest(activeTrack.notes, x, y, ppsRef.current)
        if (!hit) {
          const spb = 60 / bpm
          const snapUnit = spb / 4
          const snapped = Math.round((x / ppsRef.current) / snapUnit) * snapUnit
          const midi = Math.max(MIDI_MIN, Math.min(MIDI_MAX, MIDI_MAX - Math.floor(y / PIANO_ROW_H)))
          setTrackNotes(activeTrackId, [...activeTrack.notes, {
            note: midi, start_time: +snapped.toFixed(4), duration: +spb.toFixed(4), velocity: 80,
          }])
          syncSelection(new Set())
          draw()
        }
      }
    }
    tapStart = null
    pinchStart = null
  }

  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: true })

  return () => {
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove',  onTouchMove)
    canvas.removeEventListener('touchend',   onTouchEnd)
  }
}, [activeTrack, activeTrackId, bpm, setTrackNotes, deleteNote, draw])
```

- [ ] **Step 8: Add touchAction to canvas element style**

In the JSX, change the canvas `style` prop:
```jsx
style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
```
→
```jsx
style={{ display: 'block', cursor: 'crosshair', userSelect: 'none', touchAction: 'manipulation' }}
```

- [ ] **Step 9: Build to verify no errors**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend && npm run build 2>&1 | tail -10
```
Expected: `✓ built in` with no errors.

- [ ] **Step 10: Commit**

```bash
cd /Users/yashveersookun/Desktop/Hummed
git add frontend/src/components/PianoRoll.jsx
git commit -m "feat: piano roll touch — tap to add, long-press to delete, pinch to zoom"
```

---

### Task 3: Manual verification

**Files:** None — verification only.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/yashveersookun/Desktop/Hummed/frontend && npm run dev
```
Navigate to `http://localhost:5173`.

- [ ] **Step 2: Mobile layout check (iPhone 14 simulation)**

In browser devtools → Toggle device toolbar → iPhone 14 (390×844). Verify:
- [ ] All panels visible by scrolling vertically
- [ ] Stack order from top: Transport bar → Piano Roll area → Tracks panel → Export panel
- [ ] No horizontal page overflow
- [ ] TrackList and ExportPanel are full width

- [ ] **Step 3: Desktop layout unchanged**

Switch devtools back to desktop. Verify:
- [ ] Three-column layout: Tracks left, Piano Roll center, Export right
- [ ] Page does not scroll vertically (transport stays pinned at top)

- [ ] **Step 4: Piano Roll touch in devtools touch simulation**

Enable touch simulation in devtools. In the Piano Roll:
- [ ] Tap on empty grid cell → note appears
- [ ] Long-press an existing note (~500ms) → note is deleted
- [ ] Pinch-out with two fingers → notes get wider (zoom in)
- [ ] Pinch-in → notes get narrower (zoom out)
- [ ] Single-finger drag left/right → scrolls the piano roll horizontally
