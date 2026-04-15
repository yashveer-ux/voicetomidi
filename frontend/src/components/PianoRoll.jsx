import { useRef, useEffect, useCallback } from 'react'
import useProjectStore from '../store/projectStore'

// ─── Constants ────────────────────────────────────────────────────────────────
const MIDI_MIN = 36
const MIDI_MAX = 96
const PIANO_ROW_H = 14
const PPS = 120
const RESIZE_PX = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const noteName = midi => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`
const isBlack = midi => [1,3,6,8,10].includes(midi % 12)
function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`
}

function hitTest(notes, x, y) {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    const nx = n.start_time * PPS, nw = Math.max(n.duration * PPS, 6)
    const ny = (MIDI_MAX - n.note) * PIANO_ROW_H
    if (x >= nx && x <= nx + nw && y >= ny && y < ny + PIANO_ROW_H) {
      return { index: i, zone: x >= nx + nw - RESIZE_PX ? 'resize' : 'move' }
    }
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PianoRoll() {
  const canvasRef = useRef(null)
  const dragRef   = useRef(null)   // active note drag
  const marqueeRef = useRef(null)  // { sx, sy, ex, ey } while rubber-band selecting
  const selectedRef = useRef(new Set()) // indices of selected notes (ref = no re-render)
  const clipboardRef = useRef([])  // copied notes (relative to selection start)

  const { tracks, activeTrackId, updateNote, deleteNote, setTrackNotes, playheadPosition, setSelectedNoteIndices } = useProjectStore()
  const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0]
  const bpm = useProjectStore(s => s.bpm)

  const syncSelection = (set) => {
    selectedRef.current = set
    setSelectedNoteIndices([...set])
  }

  const allNotes = tracks.flatMap(t => t.notes)
  const maxTime  = allNotes.length
    ? Math.max(...allNotes.map(n => n.start_time + n.duration)) + 2 : 8
  const canvasH = (MIDI_MAX - MIDI_MIN + 1) * PIANO_ROW_H

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = Math.max(900, maxTime * PPS + 60)
    canvas.width = W
    canvas.height = canvasH
    ctx.clearRect(0, 0, W, canvasH)

    const spb = 60 / bpm
    const sel = selectedRef.current

    // ── Piano row backgrounds ──
    for (let midi = MIDI_MAX; midi >= MIDI_MIN; midi--) {
      const y = (MIDI_MAX - midi) * PIANO_ROW_H
      ctx.fillStyle = isBlack(midi) ? '#383835' : '#424240'
      ctx.fillRect(0, y, W, PIANO_ROW_H)
      if (midi % 12 === 0) {
        ctx.strokeStyle = '#686864'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      } else {
        ctx.strokeStyle = '#3e3e3b'; ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(0, y + PIANO_ROW_H); ctx.lineTo(W, y + PIANO_ROW_H); ctx.stroke()
      }
    }

    // ── Beat / measure grid ──
    for (let t = 0; t < maxTime + 1; t += spb / 4) {
      const x = t * PPS
      const isBeat    = Math.abs((t / spb) % 1) < 0.005
      const isMeasure = Math.abs((t / (spb * 4)) % 1) < 0.005
      ctx.strokeStyle = isMeasure ? '#5e5e5a' : isBeat ? '#4e4e4a' : '#424240'
      ctx.lineWidth = isMeasure ? 1 : 0.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke()
    }

    // ── Notes (all instrument tracks) ──
    const sorted = [...tracks].filter(t => t.type === 'instrument')
      .sort((a, b) => (a.id === activeTrackId ? 1 : -1))

    sorted.forEach(track => {
      const isActive = track.id === activeTrackId
      const rgb = hexRgb(track.color)
      track.notes.forEach((note, idx) => {
        const isSelected = isActive && sel.has(idx)
        const x = note.start_time * PPS
        const y = (MIDI_MAX - note.note) * PIANO_ROW_H
        const w = Math.max(note.duration * PPS, 6)
        const vel = (note.velocity || 80) / 127
        const alpha = isActive ? (isSelected ? 0.95 : 0.5 + vel * 0.4) : 0.25

        ctx.fillStyle = `rgba(${rgb},${alpha})`
        ctx.beginPath(); ctx.roundRect(x+1, y+1, w-2, PIANO_ROW_H-2, 3); ctx.fill()

        ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.9)' : `rgba(${rgb},${isActive ? 0.8 : 0.3})`
        ctx.lineWidth = isSelected ? 1.5 : 1
        ctx.beginPath(); ctx.roundRect(x+1, y+1, w-2, PIANO_ROW_H-2, 3); ctx.stroke()

        if (isActive && !isSelected) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.beginPath(); ctx.roundRect(x+w-RESIZE_PX, y+1, RESIZE_PX-1, PIANO_ROW_H-2, [0,3,3,0]); ctx.fill()
        }
        if (w > 24 && isActive) {
          ctx.fillStyle = '#fff'
          ctx.font = '8px Chivo Mono, monospace'
          ctx.fillText(noteName(note.note), x+4, y+PIANO_ROW_H-4)
        }
      })
    })

    // ── Marquee selection rect ──
    const m = marqueeRef.current
    if (m) {
      const rx = Math.min(m.sx, m.ex), ry = Math.min(m.sy, m.ey)
      const rw = Math.abs(m.ex - m.sx), rh = Math.abs(m.ey - m.sy)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
    }

    // ── Playhead ──
    const playX = playheadPosition * PPS
    ctx.strokeStyle = '#ff5c1a'; ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, canvasH); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ff5c1a'
    ctx.beginPath(); ctx.moveTo(playX-5, 0); ctx.lineTo(playX+5, 0); ctx.lineTo(playX, 7); ctx.fill()
  }, [tracks, activeTrackId, playheadPosition, canvasH, maxTime, bpm])

  useEffect(() => { draw() }, [draw])

  // Clear selection when active track changes
  useEffect(() => { syncSelection(new Set()); draw() }, [activeTrackId])

  // ── Canvas coords ─────────────────────────────────────────────────────────
  const canvasPos = e => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // Which note indices fall inside the marquee rect
  const notesInRect = (notes, m) => {
    const x1 = Math.min(m.sx, m.ex), x2 = Math.max(m.sx, m.ex)
    const y1 = Math.min(m.sy, m.ey), y2 = Math.max(m.sy, m.ey)
    const found = new Set()
    notes.forEach((n, i) => {
      const nx = n.start_time * PPS, nw = Math.max(n.duration * PPS, 6)
      const ny = (MIDI_MAX - n.note) * PIANO_ROW_H
      if (nx < x2 && nx + nw > x1 && ny < y2 && ny + PIANO_ROW_H > y1) found.add(i)
    })
    return found
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(e => {
    e.preventDefault()
    const { x, y } = canvasPos(e)

    // Right-click → delete hovered note, or all selected if clicking a selected note
    if (e.button === 2) {
      const hit = hitTest(activeTrack.notes, x, y)
      if (hit) {
        if (selectedRef.current.has(hit.index) && selectedRef.current.size > 1) {
          setTrackNotes(activeTrackId, activeTrack.notes.filter((_, i) => !selectedRef.current.has(i)))
        } else {
          deleteNote(activeTrackId, hit.index)
        }
        syncSelection(new Set())
        draw()
      }
      return
    }
    if (e.button !== 0) return

    const hit = hitTest(activeTrack.notes, x, y)

    if (hit) {
      // Shift+click → toggle this note in selection
      if (e.shiftKey) {
        const next = new Set(selectedRef.current)
        next.has(hit.index) ? next.delete(hit.index) : next.add(hit.index)
        syncSelection(next)
        draw()
        return
      }

      // Click on unselected note → select just this one
      if (!selectedRef.current.has(hit.index)) {
        syncSelection(new Set([hit.index]))
        draw()
      }

      // Start drag: capture original positions of all selected notes
      const origPositions = {}
      activeTrack.notes.forEach((n, i) => {
        if (selectedRef.current.has(i)) {
          origPositions[i] = { start_time: n.start_time, note: n.note, duration: n.duration }
        }
      })
      dragRef.current = {
        zone: hit.zone, startX: x, startY: y, origPositions,
        anchorDuration: activeTrack.notes[hit.index].duration,
      }
      return
    }

    // Click on empty space → start marquee
    syncSelection(new Set())
    marqueeRef.current = { sx: x, sy: y, ex: x, ey: y }
    draw()
  }, [activeTrack, activeTrackId, bpm, deleteNote, setTrackNotes, draw])

  const handleMouseMove = useCallback(e => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = canvasPos(e)

    if (dragRef.current) {
      const drag = dragRef.current
      const dx = x - drag.startX, dy = y - drag.startY

      if (drag.zone === 'resize') {
        canvas.style.cursor = 'ew-resize'
        // Only resize the anchor note
        const [anchorIdx] = Object.keys(drag.origPositions)
        const orig = drag.origPositions[anchorIdx]
        updateNote(activeTrackId, parseInt(anchorIdx), {
          duration: +Math.max(0.05, orig.duration + dx / PPS).toFixed(4)
        })
      } else {
        canvas.style.cursor = 'grabbing'
        const dTime = dx / PPS
        const dNote = -Math.round(dy / PIANO_ROW_H)
        Object.entries(drag.origPositions).forEach(([idxStr, orig]) => {
          updateNote(activeTrackId, parseInt(idxStr), {
            start_time: +Math.max(0, orig.start_time + dTime).toFixed(4),
            note: Math.max(MIDI_MIN, Math.min(MIDI_MAX, orig.note + dNote)),
          })
        })
      }
      return
    }

    if (marqueeRef.current) {
      marqueeRef.current = { ...marqueeRef.current, ex: x, ey: y }
      syncSelection(notesInRect(activeTrack.notes, marqueeRef.current))
      draw()
      return
    }

    // Cursor hint
    const hit = hitTest(activeTrack.notes, x, y)
    canvas.style.cursor = hit?.zone === 'resize' ? 'ew-resize' : hit ? 'grab' : 'crosshair'
  }, [activeTrack, activeTrackId, updateNote, draw])

  const handleMouseUp = useCallback(() => {
    const m = marqueeRef.current
    if (m) {
      const dx = Math.abs(m.ex - m.sx), dy = Math.abs(m.ey - m.sy)
      // Tiny click on empty = create a note
      if (dx < 4 && dy < 4) {
        const spb = 60 / bpm
        const snapUnit = spb / 4
        const snapped = Math.round((m.sx / PPS) / snapUnit) * snapUnit
        const midi = Math.max(MIDI_MIN, Math.min(MIDI_MAX, MIDI_MAX - Math.floor(m.sy / PIANO_ROW_H)))
        setTrackNotes(activeTrackId, [...activeTrack.notes, {
          note: midi, start_time: +snapped.toFixed(4), duration: +spb.toFixed(4), velocity: 80,
        }])
        syncSelection(new Set())
      }
      marqueeRef.current = null
      draw()
    }

    dragRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
  }, [activeTrack, activeTrackId, bpm, setTrackNotes, draw])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ── Copy / Paste keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = e => {
      if (!e.metaKey && !e.ctrlKey) return
      const notes = activeTrack?.notes
      if (!notes) return

      if (e.key === 'c') {
        const sel = selectedRef.current
        if (sel.size === 0) return
        e.preventDefault()
        const selected = [...sel].map(i => notes[i])
        const minStart = Math.min(...selected.map(n => n.start_time))
        clipboardRef.current = selected.map(n => ({ ...n, start_time: n.start_time - minStart }))
      }

      if (e.key === 'v') {
        const clipboard = clipboardRef.current
        if (clipboard.length === 0) return
        e.preventDefault()
        const spb = 60 / bpm
        // Paste after the last note currently in the track (or at 0 if empty)
        const pasteAt = notes.length
          ? Math.max(...notes.map(n => n.start_time + n.duration))
          : 0
        const pasted = clipboard.map(n => ({ ...n, start_time: +(pasteAt + n.start_time).toFixed(4) }))
        const newNotes = [...notes, ...pasted]
        setTrackNotes(activeTrackId, newNotes)
        // Select the newly pasted notes
        const pastedIndices = new Set(pasted.map((_, i) => notes.length + i))
        syncSelection(pastedIndices)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTrack, activeTrackId, bpm, setTrackNotes])

  // ── Key labels ────────────────────────────────────────────────────────────
  const keyLabels = Array.from({ length: MIDI_MAX - MIDI_MIN + 1 }, (_, i) => {
    const midi = MIDI_MAX - i
    const black = isBlack(midi)
    return (
      <div key={midi} style={{ ...s.pianoKey, background: black ? '#4a4a47' : '#f0eeea', color: black ? '#a8a8a4' : '#888684' }}>
        {midi % 12 === 0 ? noteName(midi) : ''}
      </div>
    )
  })

  const instrTracks = tracks.filter(t => t.type === 'instrument')

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>🎹 Piano Roll</span>
        {instrTracks.length > 0 && (
          <div style={s.legend}>
            {instrTracks.map(t => (
              <span key={t.id} style={s.legendItem}>
                <span style={{ ...s.legendDot, background: t.color, boxShadow: t.id === activeTrackId ? `0 0 6px ${t.color}` : 'none' }} />
                <span style={{ color: t.id === activeTrackId ? 'var(--text)' : 'var(--text-muted)', fontSize: 11 }}>{t.name}</span>
              </span>
            ))}
          </div>
        )}
        <span style={s.hint}>Click to add · Drag to move · Right-edge to resize · Drag empty area to select · Shift+click to multi-select · Right-click to delete · ⌘C copy · ⌘V paste</span>
      </div>

      <div style={s.rollRow}>
        <div style={s.keyCol}>{keyLabels}</div>
        <div style={s.scrollArea}>
          <canvas
            ref={canvasRef}
            width={900} height={canvasH}
            onMouseDown={handleMouseDown}
            onContextMenu={e => e.preventDefault()}
            style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
    borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0,
  },
  title: { fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' },
  legend: { display: 'flex', gap: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: '50%', transition: 'box-shadow 0.2s' },
  hint: { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' },
  rollRow: { display: 'flex', flex: 1, overflowX: 'hidden', overflowY: 'auto', alignItems: 'flex-start' },
  keyCol: { display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid var(--border)' },
  pianoKey: {
    height: PIANO_ROW_H, minWidth: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'flex-end', paddingRight: 4, fontSize: 7, fontFamily: 'var(--font-mono)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  scrollArea: { flex: 1, overflowX: 'auto', overflowY: 'visible' },
}
