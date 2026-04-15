import useProjectStore from '../store/projectStore'

const PRESETS = [
  { id: 'piano',   label: 'Piano',   icon: '🎹' },
  { id: 'guitar',  label: 'Guitar',  icon: '🎸' },
  { id: 'synth',   label: 'Synth',   icon: '🎛️' },
  { id: 'strings', label: 'Strings', icon: '🎻' },
]

export default function InstrumentPalette() {
  const { tracks, activeTrackId, updateTrack } = useProjectStore()
  const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0]

  if (activeTrack.type === 'drums') return null

  const instrument = activeTrack.instrument
  const color = activeTrack.color

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>INSTRUMENT</span>
        <span style={s.sub}>{activeTrack.name}</span>
      </div>
      <div style={s.grid}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            style={{
              ...s.btn,
              background: instrument === p.id ? 'var(--surface-3)' : 'var(--surface-2)',
              borderColor: instrument === p.id ? color : 'var(--border)',
              color: instrument === p.id ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: instrument === p.id ? `0 0 8px ${color}55` : 'none',
            }}
            onClick={() => updateTrack(activeTrackId, { instrument: p.id })}
          >
            <span style={s.icon}>{p.icon}</span>
            <span style={s.label}>{p.label}</span>
          </button>
        ))}
        <label style={s.importBtn} title="Import a .sf2 SoundFont file (for WAV export)">
          <span style={s.icon}>📂</span>
          <span style={s.label}>Import .sf2</span>
          <input type="file" accept=".sf2" onChange={e => {
            const f = e.target.files[0]
            if (f && f.size <= 50 * 1024 * 1024) updateTrack(activeTrackId, { instrument: 'custom', customSoundfont: f })
            else if (f) alert('SoundFont must be under 50MB')
          }} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '12px 14px',
  },
  header: { marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 },
  title: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' },
  sub: { fontSize: 11, color: 'var(--text-dim)' },
  grid: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btn: {
    display: 'flex', alignItems: 'center', gap: 5,
    border: '1px solid', borderRadius: 'var(--radius)',
    padding: '6px 10px', fontSize: 11, fontWeight: 600,
    transition: 'all 0.15s', cursor: 'pointer',
  },
  icon: { fontSize: 13 },
  label: { fontFamily: 'var(--font-ui)' },
  importBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'var(--surface-2)', color: 'var(--text-muted)',
    border: '1px dashed var(--border-2)', borderRadius: 'var(--radius)',
    padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
}
