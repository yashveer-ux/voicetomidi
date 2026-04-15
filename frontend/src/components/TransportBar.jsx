import useProjectStore from '../store/projectStore'
import { useMetronome } from '../hooks/useMetronome'

export default function TransportBar({ onPlay, onStop, backendStatus, isLooping, onToggleLoop, loopBars, onSetLoopBars }) {
  const { bpm, setBpm, isPlaying, isMetronomeOn, setIsMetronomeOn } = useProjectStore()
  useMetronome(bpm, isMetronomeOn)

  return (
    <div style={s.bar}>
      {/* Play / Stop */}
      <div style={s.group}>
        <button style={isPlaying ? s.stopBtn : s.playBtn} onClick={isPlaying ? onStop : onPlay}>
          {isPlaying
            ? <><span style={s.btnIcon}>■</span> Stop</>
            : <><span style={s.btnIcon}>▶</span> Play</>}
        </button>
      </div>

      {/* BPM */}
      <div style={s.group}>
        <span style={s.label}>BPM</span>
        <input
          type="number" min={40} max={240} value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          style={s.bpmNum}
        />
        <input
          type="range" min={40} max={240} value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
          style={s.slider}
        />
      </div>

      {/* Loop */}
      <button
        style={isLooping ? s.metrOn : s.metrOff}
        onClick={onToggleLoop}
        title="Loop playback"
      >
        ↻ Loop
      </button>

      {/* Bar length */}
      <div style={s.group}>
        <span style={s.label}>BARS</span>
        {[4, 8, 16].map(b => (
          <button
            key={b}
            style={{ ...s.barBtn, ...(loopBars === b ? s.barBtnActive : {}) }}
            onClick={() => onSetLoopBars(b)}
          >{b}</button>
        ))}
      </div>

      {/* Metronome */}
      <button
        style={isMetronomeOn ? s.metrOn : s.metrOff}
        onClick={() => setIsMetronomeOn(!isMetronomeOn)}
        title="Toggle metronome"
      >
        <span style={{ fontSize: 14 }}>𝅘𝅥𝅮</span> Metro
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Backend status */}
      <div style={s.status}>
        <span style={{ ...s.dot, background: backendStatus === 'ok' ? '#00e5d4' : backendStatus === 'checking' ? '#ff5c1a' : '#e74c3c' }} />
        <span style={s.statusText}>
          {backendStatus === 'ok' ? 'API connected' : backendStatus === 'checking' ? 'connecting…' : 'API offline'}
        </span>
      </div>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 16px', height: 48,
    background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  group: { display: 'flex', alignItems: 'center', gap: 8 },
  label: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 },
  playBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--teal)', color: '#000',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '6px 14px', fontWeight: 700, fontSize: 12,
    letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
    boxShadow: '0 0 12px var(--teal-glow)',
  },
  stopBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '6px 14px', fontWeight: 700, fontSize: 12,
    letterSpacing: 0.5, fontFamily: 'var(--font-ui)',
    boxShadow: '0 0 12px var(--accent-glow)',
  },
  btnIcon: { fontSize: 10 },
  bpmNum: {
    width: 52, background: 'var(--surface-3)', border: '1px solid var(--border-2)',
    borderRadius: 'var(--radius)', color: 'var(--text)',
    padding: '4px 6px', fontSize: 14, fontWeight: 700,
    fontFamily: 'var(--font-mono)', textAlign: 'center',
  },
  slider: { width: 100, accentColor: 'var(--accent)', cursor: 'pointer' },
  metrOn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '5px 12px', fontWeight: 600, fontSize: 12,
    boxShadow: '0 0 10px var(--accent-glow)',
  },
  metrOff: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'var(--surface-3)', color: 'var(--text-muted)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '5px 12px', fontWeight: 600, fontSize: 12,
  },
  status: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  statusText: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' },
  barBtn: {
    background: 'var(--surface-3)', color: 'var(--text-muted)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    padding: '3px 8px', fontSize: 11, fontWeight: 600,
    fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
  },
  barBtnActive: {
    background: 'var(--teal)', color: '#000',
    border: '1px solid var(--teal)',
    boxShadow: '0 0 6px var(--teal-glow)',
  },
}
