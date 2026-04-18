# Mobile Responsive Design Spec

## Overview

Make the existing VOICEtoMIDI web app usable on phones without building a separate app or separate route. One codebase, two layouts — desktop stays as-is, mobile gets a single-column scroll layout.

---

## Breakpoint

- **Mobile:** viewport width ≤ 768px
- **Desktop:** viewport width > 768px

No changes to routing or component tree. All layout switching is done via CSS media queries and/or conditional className logic.

---

## Mobile Layout

The current desktop layout is a 3-column flex row:

```
[ Tracks Panel ] [ Piano Roll ] [ Export Panel ]
```

On mobile (≤ 768px), this collapses into a single full-width vertical scroll:

```
┌─────────────────────┐
│   Transport Bar     │  (BPM, play/stop, loop)
├─────────────────────┤
│   Record Section    │  (mic button, status)
├─────────────────────┤
│   Piano Roll        │  (full-width touch canvas)
├─────────────────────┤
│   Tracks List       │  (instrument rows, mute/solo)
├─────────────────────┤
│   Export Panel      │  (format buttons, download)
└─────────────────────┘
```

Each section is full viewport width. The user scrolls vertically through them.

---

## Piano Roll on Mobile

**Option chosen: Full Roll, Touch-Enabled** (same canvas as desktop).

Touch interactions:
- **Single finger swipe** → scroll (horizontal = time axis, vertical = pitch axis)
- **Pinch** → zoom in/out on time axis
- **Tap on empty grid cell** → add note at that pitch/time
- **Long-press on an existing note** → delete it

The piano roll canvas already handles mouse events. Touch events need to be added alongside them (not replacing them). Use `touchstart`, `touchmove`, `touchend` events.

Minimum tap target size: 44×44px (Apple HIG). If the grid rows are too small at default zoom, the user can pinch to zoom in first.

---

## Existing Component Structure

Key files that will change:

| File | What changes |
|------|-------------|
| `frontend/src/App.jsx` | Wrap 3-column layout in responsive CSS classes |
| `frontend/src/components/PianoRoll.jsx` | Add touch event handlers |
| `frontend/src/index.css` (or App.css) | Add `@media` rules for mobile layout |

No new components. No new routes.

---

## CSS Approach

Use a utility class or direct media query in the existing stylesheet. The 3-column container gets:

```css
.app-layout {
  display: flex;
  flex-direction: row;
}

@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
  }
}
```

Each panel already takes up its natural width; on mobile it becomes `width: 100%`.

The piano roll canvas should have `touch-action: none` on mobile to prevent the browser's default scroll/zoom from interfering with custom touch handling.

---

## Touch Event Implementation

Add to `PianoRoll.jsx`:

```js
// Pinch state
const pinchRef = useRef(null)

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    // potential tap or long-press
    longPressTimer.current = setTimeout(() => deleteNoteAt(e.touches[0]), 500)
  } else if (e.touches.length === 2) {
    pinchRef.current = { dist: pinchDist(e), scrollLeft: canvasRef.current.scrollLeft }
  }
}

function handleTouchMove(e) {
  clearTimeout(longPressTimer.current)
  if (e.touches.length === 1) {
    // single finger scroll
    scrollBy(e)
  } else if (e.touches.length === 2 && pinchRef.current) {
    const ratio = pinchDist(e) / pinchRef.current.dist
    setZoom(baseZoom * ratio)
  }
}

function handleTouchEnd(e) {
  clearTimeout(longPressTimer.current)
  if (wasTap) addNoteAt(tapPosition)
}
```

A "tap" is a `touchstart`+`touchend` with < 10px movement and < 200ms duration.

---

## What Does NOT Change

- Desktop layout: untouched
- All existing keyboard shortcuts (Cmd+C, Cmd+V, etc.): still work
- Backend: no changes
- Routing: no changes
- State management: no changes

---

## Success Criteria

- [ ] On a 390px-wide viewport (iPhone 14), all sections are visible by scrolling
- [ ] Piano roll is usable with touch (can add and delete notes)
- [ ] Pinch zooms the time axis
- [ ] No horizontal overflow / no need to scroll the page horizontally
- [ ] Desktop layout is pixel-identical to before
