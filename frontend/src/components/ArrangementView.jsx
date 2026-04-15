import { useRef, useEffect, useCallback, useState } from 'react'
import useProjectStore from '../store/projectStore'
import Knob from './Knob'

// ── Constants ──────────────────────────────────────────────────────────────────
const LANE_H = 56
const PPS    = 120
const MIDI_MIN = 36
const MIDI_MAX = 96

function hexRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ArrangementView() {
  const {
    tracks, activeTrackId, setActiveTrackId,
    playheadPosition, updateNote, updateTrack, bpm,
  } = useProjectStore()
  const setTrackVolume = (id, volume) => updateTrack(id, { volume })

  const canvasRef = useRef(null)
  const dragRef   = useRef(null)
  const [editingId, setEditingId] = useState(null)

  const allNotes = tracks.flatMap(t => t.notes)
  const maxTime  = allNotes.length
    ? Math.max(...allNotes.map(n => n.start_time + n.duration)) + 2
    : 8
  const canvasW = Math.max(900, maxTime * PPS + 60)
  const canvasH = tracks.length * LANE_H

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = canvasW
    canvas.height = canvasH
    ctx.clearRect(0, 0, canvasW, canvasH)

    const spb = 60 / bpm

    tracks.forEach((track, i) => {
      const laneY    = i * LANE_H
      const isActive = track.id === activeTrackId
      const rgb      = hexRgb(track.color)

      // Lane background
      ctx.fillStyle = isActive ? '#383835' : '#424240'
      ctx.fillRect(0, laneY, canvasW, LANE_H)

      // Beat / measure grid
      for (let t = 0; t < maxTime + 1; t += spb / 4) {
        const x = t * PPS
        const isMeasure = Math.abs((t / (spb * 4)) % 1) < 0.005
        const isBeat    = !isMeasure && Math.abs((t / spb) % 1) < 0.005
        ctx.strokeStyle = isMeasure ? '#5e5e5a' : isBeat ? '#4e4e4a' : '#424240'
        ctx.lineWidth   = isMeasure ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(x, laneY)
        ctx.lineTo(x, laneY + LANE_H)
        ctx.stroke()
      }

      // Active-track color bar on left edge
      if (isActive) {
        ctx.fillStyle = track.color
        ctx.fillRect(0, laneY, 3, LANE_H)
      }

      // Lane separator
      ctx.strokeStyle = '#686864'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, laneY + LANE_H - 0.5)
      ctx.lineTo(canvasW, laneY + LANE_H - 0.5)
      ctx.stroke()

      // Notes
      track.notes.forEach(note => {
        const nx = note.start_time * PPS
        const nw = Math.max(note.duration * PPS, 6)
        const fillRgb = rgb
        const frac = (note.note - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)
        const nh = 5
        const ny = laneY + LANE_H - 8 - frac * (LANE_H - 18)

        ctx.fillStyle = `rgba(${fillRgb},${isActive ? 0.88 : 0.4})`
        ctx.beginPath()
        ctx.roundRect(nx, ny, nw, nh, 2)
        ctx.fill()

        // Border on active notes
        if (isActive) {
          ctx.strokeStyle = `rgba(${fillRgb},0.6)`
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.roundRect(nx, ny, nw, nh, 2)
          ctx.stroke()
        }
      })
    })

    // Playhead
    const px = playheadPosition * PPS
    ctx.strokeStyle = '#ff5c1a'
    ctx.lineWidth   = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvasH); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ff5c1a'
    ctx.beginPath(); ctx.moveTo(px - 5, 0); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 7); ctx.fill()
  }, [tracks, activeTrackId, playheadPosition, canvasW, canvasH, maxTime, bpm])

  useEffect(() => { draw() }, [draw])

  // ── Hit test ────────────────────────────────────────────────────────────────
  const hitTest = useCallback((x, y) => {
    const i = Math.floor(y / LANE_H)
    if (i < 0 || i >= tracks.length) return null
    const track  = tracks[i]
    const laneY  = i * LANE_H
    const spb    = 60 / bpm

    for (let j = track.notes.length - 1; j >= 0; j--) {
      const note = track.notes[j]
      const nx   = note.start_time * PPS
      const nw   = Math.max(note.duration * PPS, 6)

      const frac = (note.note - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)
      const nh = 5
      const ny = laneY + LANE_H - 8 - frac * (LANE_H - 18)

      // Expand hit target slightly for usability
      if (x >= nx - 2 && x <= nx + nw + 2 && y >= ny - 3 && y <= ny + nh + 3) {
        return { trackId: track.id, noteIndex: j, origStartTime: note.start_time, snapUnit: spb / 4 }
      }
    }
    // Lane clicked but no note → just select track
    return { trackId: track.id, noteIndex: -1 }
  }, [tracks, bpm])

  // ── Mouse coords ─────────────────────────────────────────────────────────
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(e => {
    if (e.button !== 0) return
    e.preventDefault()
    const { x, y } = pos(e)
    const hit = hitTest(x, y)
    if (!hit) return
    setActiveTrackId(hit.trackId)
    if (hit.noteIndex === -1) return
    dragRef.current = { ...hit, startX: x }
  }, [hitTest, setActiveTrackId])

  const handleMouseMove = useCallback(e => {
    const drag = dragRef.current
    if (!drag) {
      // Update cursor
      if (!canvasRef.current) return
      const { x, y } = pos(e)
      const hit = hitTest(x, y)
      canvasRef.current.style.cursor = hit?.noteIndex !== -1 ? 'grab' : 'default'
      return
    }
    canvasRef.current.style.cursor = 'grabbing'
    const { x } = pos(e)
    const raw     = Math.max(0, drag.origStartTime + (x - drag.startX) / PPS)
    const snapped = Math.round(raw / drag.snapUnit) * drag.snapUnit
    updateNote(drag.trackId, drag.noteIndex, { start_time: +snapped.toFixed(4) })
  }, [hitTest, updateNote])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'default'
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.wrap}>
      <div style={s.titleBar}>
        <span style={s.titleLabel}>ARRANGEMENT</span>
        <span style={s.hint}>Drag blocks to reposition · Double-click name to rename</span>
      </div>

      <div style={s.body}>
        {/* Track label column */}
        <div style={s.labelCol}>
          {tracks.map(track => {
            const active = track.id === activeTrackId
            return (
              <div
                key={track.id}
                style={{ ...s.label, background: active ? '#0e0e2a' : 'transparent' }}
                onClick={() => setActiveTrackId(track.id)}
              >
                <div style={{ ...s.colorBar, background: track.color, opacity: active ? 1 : 0.45 }} />
                <div style={s.labelInfo}>
                  {editingId === track.id ? (
                    <input
                      autoFocus style={s.nameInput} defaultValue={track.name}
                      onBlur={e => { updateTrack(track.id, { name: e.target.value }); setEditingId(null) }}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      style={{ ...s.labelName, color: active ? 'var(--text)' : 'var(--text-muted)' }}
                      onDoubleClick={e => { e.stopPropagation(); setEditingId(track.id) }}
                    >
                      {track.name}
                    </span>
                  )}
                  <span style={s.labelType}>{`♩ ${track.instrument}`}</span>
                </div>
                <Knob
                  value={track.volume ?? 1}
                  onChange={v => setTrackVolume(track.id, v)}
                  min={0} max={1.5} size={28}
                  color={track.color}
                  label="Vol"
                />
              </div>
            )
          })}
        </div>

        {/* Canvas scroll area */}
        <div style={s.canvasScroll}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onContextMenu={e => e.preventDefault()}
            style={{ display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden', flexShrink: 0,
  },
  titleBar: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '7px 14px', borderBottom: '1px solid var(--border)',
  },
  titleLabel: {
    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
    color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  hint: { fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' },
  body: { display: 'flex' },
  labelCol: {
    width: 155, flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
  },
  label: {
    height: LANE_H, display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 8px', cursor: 'pointer',
    borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
  },
  colorBar: { width: 4, height: 30, borderRadius: 2, flexShrink: 0, transition: 'opacity 0.15s' },
  labelInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  labelName: {
    fontSize: 11, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    transition: 'color 0.1s',
  },
  nameInput: {
    background: 'var(--surface-2)', border: '1px solid var(--purple)',
    borderRadius: 3, color: 'var(--text)', fontSize: 10, padding: '2px 4px', width: '100%',
    fontFamily: 'var(--font-ui)',
  },
  labelType: { fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' },
  canvasScroll: { flex: 1, overflowX: 'auto', overflowY: 'hidden' },
}
