import { useState } from 'react'
import useProjectStore from '../store/projectStore'

const INSTRUMENTS = ['piano', 'guitar', 'synth', 'strings']

export default function TrackList({ onPlayTrack }) {
  const { tracks, activeTrackId, setActiveTrackId, addTrack, removeTrack, toggleMute, updateTrack } = useProjectStore()
  const [editingId, setEditingId] = useState(null)

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.headerLabel}>TRACKS</span>
        <div style={s.addRow}>
          <button style={s.addBtn} onClick={() => addTrack()} title="Add track">
            + TRACK
          </button>
        </div>
      </div>

      <div style={s.list}>
        {tracks.map(track => {
          const active = track.id === activeTrackId
          return (
            <div
              key={track.id}
              style={{ ...s.track, background: active ? 'var(--surface-3)' : 'transparent' }}
              onClick={() => setActiveTrackId(track.id)}
            >
              {/* Active indicator bar */}
              <div style={{ ...s.activeLine, opacity: active ? 1 : 0, background: track.color }} />

              {/* Color swatch */}
              <div style={{ ...s.swatch, background: track.color, boxShadow: active ? `0 0 8px ${track.color}88` : 'none' }} />

              {/* Info */}
              <div style={s.info}>
                {editingId === track.id ? (
                  <input
                    autoFocus style={s.nameInput} defaultValue={track.name}
                    onBlur={e => { updateTrack(track.id, { name: e.target.value }); setEditingId(null) }}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    style={{ ...s.name, color: active ? 'var(--text)' : 'var(--text-muted)' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingId(track.id) }}
                  >
                    {track.name}
                  </span>
                )}
                {active ? (
                  <select
                    style={s.instSelect}
                    value={track.instrument}
                    onChange={e => { e.stopPropagation(); updateTrack(track.id, { instrument: e.target.value }) }}
                    onClick={e => e.stopPropagation()}
                  >
                    {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                ) : (
                  <span style={s.typeTag}>{`♩ ${track.instrument}`}</span>
                )}
              </div>

              {/* Actions */}
              <div style={s.actions}>
                <button
                  style={s.playTrackBtn}
                  onClick={e => { e.stopPropagation(); onPlayTrack && onPlayTrack(track) }}
                  title="Preview this track"
                >▶</button>
                <button
                  style={{ ...s.checkBtn, color: track.muted ? 'var(--text-dim)' : 'var(--teal)', borderColor: track.muted ? 'var(--border)' : 'var(--teal)' }}
                  onClick={e => { e.stopPropagation(); toggleMute(track.id) }}
                  title={track.muted ? 'Excluded from playback (click to include)' : 'Included in playback (click to exclude)'}
                >{track.muted ? '○' : '✓'}</button>
                {tracks.length > 1 && (
                  <button
                    style={s.delBtn}
                    onClick={e => { e.stopPropagation(); removeTrack(track.id) }}
                    title="Remove track"
                  >✕</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
    background: 'var(--surface)', borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 12px 8px', borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  headerLabel: {
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 2,
    color: 'var(--text-muted)', textTransform: 'uppercase',
  },
  addRow: { display: 'flex', gap: 4 },
  addBtn: {
    flex: 1, background: 'var(--surface-3)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius)', color: 'var(--text-muted)',
    padding: '4px 0', fontSize: 9, fontWeight: 700,
    fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
    transition: 'all 0.15s',
  },
  list: { flex: 1, overflowY: 'auto' },
  track: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.1s', position: 'relative',
    minHeight: 52,
  },
  activeLine: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderRadius: '0 2px 2px 0', transition: 'opacity 0.1s',
  },
  swatch: { width: 10, height: 32, borderRadius: 3, flexShrink: 0, transition: 'box-shadow 0.2s' },
  info: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  name: {
    fontSize: 12, fontWeight: 600, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.1s',
  },
  nameInput: {
    background: 'var(--surface-2)', border: '1px solid var(--purple)',
    borderRadius: 3, color: 'var(--text)', fontSize: 11, padding: '2px 5px', width: '100%',
    fontFamily: 'var(--font-ui)',
  },
  typeTag: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  instSelect: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 3, color: 'var(--text-muted)', fontSize: 10, padding: '2px 4px',
    fontFamily: 'var(--font-mono)',
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' },
  playTrackBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 3, color: 'var(--text-dim)',
    padding: '2px 5px', fontSize: 9,
    transition: 'all 0.15s',
  },
  checkBtn: {
    background: 'transparent', border: '1px solid', borderRadius: 3,
    padding: '2px 5px', fontSize: 10, fontWeight: 700,
    fontFamily: 'var(--font-mono)', transition: 'all 0.15s', minWidth: 20,
  },
  delBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--text-dim)', fontSize: 11, padding: '0 2px',
    transition: 'color 0.15s',
  },
}
