import { useState } from 'react'
import { exportProject } from '../api/client'
import useProjectStore from '../store/projectStore'

export default function ExportPanel() {
  const { tracks, bpm, projectName, setProjectName } = useProjectStore()
  const notes = tracks.flatMap(t => t.notes)
  const instrument = tracks.find(t => t.type === 'instrument')?.instrument || 'piano'

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFormatPicker, setShowFormatPicker] = useState(false)

  const handleExport = async (fmt) => {
    setLoading(true)
    setShowFormatPicker(false)
    setStatus('Exporting…')
    try {
      const blob = await exportProject(notes, [], instrument, bpm, fmt)
      const ext = fmt === 'midi' ? 'mid' : fmt
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${projectName || 'export'}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus('✓ Downloaded')
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
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

      <div style={s.divider} />
      <span style={s.exportLabel}>EXPORT</span>

      {!showFormatPicker ? (
        <div style={s.row}>
          <button
            style={s.exportMainBtn}
            onClick={() => setShowFormatPicker(true)}
            disabled={loading || notes.length === 0}
          >
            ↓ Export
          </button>
        </div>
      ) : (
        <div style={s.row}>
          {['wav', 'mp3', 'midi'].map(fmt => (
            <button
              key={fmt}
              style={s.exportBtn}
              onClick={() => handleExport(fmt)}
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

      <div style={s.divider} />
      <a
        href="https://buymeacoffee.com/monkeyswag1411"
        target="_blank"
        rel="noopener noreferrer"
        style={s.coffeeBtn}
      >
        ☕ Buy me a coffee
      </a>

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
  divider: { height: 1, background: '#c8c6c2', margin: '8px 0' },
  exportLabel: { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: '#888684', letterSpacing: 1.5, marginBottom: 8 },
  exportMainBtn: {
    flex: 1, background: 'var(--accent)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius)', padding: '8px 14px',
    fontWeight: 700, fontSize: 12, fontFamily: 'var(--font-mono)',
    boxShadow: '0 0 10px var(--accent-glow)', letterSpacing: 0.5,
    cursor: 'pointer',
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
    padding: '6px 10px', fontSize: 11, cursor: 'pointer',
  },
  status: { fontSize: 11, marginTop: 6, fontFamily: 'var(--font-mono)' },
  coffeeBtn: {
    display: 'block', textAlign: 'center',
    background: '#FFDD00', color: '#000',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '7px 14px', fontWeight: 700, fontSize: 12,
    fontFamily: 'var(--font-ui)', textDecoration: 'none',
    marginTop: 4,
  },
}
