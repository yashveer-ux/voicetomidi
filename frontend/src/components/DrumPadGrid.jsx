import { useState } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { analyzeBeatbox } from '../api/client'
import useProjectStore from '../store/projectStore'

const PAD_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63']

function DrumPad({ pad, isActivePad, onSelectPad }) {
  const hasClip = !!pad.audioBlob

  return (
    <div
      style={{
        ...styles.pad,
        background: isActivePad ? PAD_COLORS[pad.padIndex] : '#1e1e3a',
        border: `2px solid ${hasClip ? PAD_COLORS[pad.padIndex] : '#333'}`,
        boxShadow: isActivePad ? `0 0 16px ${PAD_COLORS[pad.padIndex]}88` : 'none',
      }}
      onClick={() => onSelectPad(pad.padIndex)}
    >
      <div style={styles.padLabel}>{pad.label}</div>
      {hasClip && <div style={styles.padDot}>●</div>}
    </div>
  )
}

export default function DrumPadGrid() {
  const { tracks, activeTrackId, updateDrumPad, setTrackDrumHits, bpm } = useProjectStore()
  const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0]
  const drumPads = activeTrack.drumPads
  const { isRecording, audioBlob, startRecording, stopRecording } = useRecorder()
  const [activePad, setActivePad] = useState(null)
  const [beatboxMode, setBeatboxMode] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSelectPad = (padIndex) => {
    setActivePad(padIndex)
  }

  const handleRecordForPad = async () => {
    if (!isRecording) {
      await startRecording()
    } else {
      stopRecording()
    }
  }

  const handleAssignClip = () => {
    if (activePad === null || !audioBlob) return
    updateDrumPad(activeTrackId, activePad, {
      audioBlob,
      label: `Pad ${activePad + 1}`,
    })
    setStatus(`✓ Sound assigned to Pad ${activePad + 1}`)
  }

  const handleBeatboxRecord = async () => {
    if (!isRecording) {
      await startRecording()
      setStatus(`Recording beatbox — ${Math.round((60 / bpm) * 4 * 4)}s max (4 bars)`)
      // Auto-stop after 4 bars
      const barDuration = (60 / bpm) * 4 * 4 * 1000
      setTimeout(() => stopRecording(), barDuration)
    }
  }

  const handleBeatboxAnalyze = async () => {
    if (!audioBlob) return
    setLoading(true)
    setStatus('Analyzing beatbox…')
    try {
      const result = await analyzeBeatbox(audioBlob, bpm, 4)
      setTrackDrumHits(activeTrackId, result.hits)
      setStatus(`✓ Detected ${result.count} drum hits — mapped to grid`)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🥁 Drum Pads</h3>
        <div style={styles.modeToggle}>
          <button
            style={beatboxMode ? styles.modeBtn : styles.modeBtnActive}
            onClick={() => setBeatboxMode(false)}
          >
            Manual
          </button>
          <button
            style={beatboxMode ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => setBeatboxMode(true)}
          >
            Beatbox
          </button>
        </div>
      </div>

      <div style={styles.padGrid}>
        {drumPads.map((pad) => (
          <DrumPad
            key={pad.padIndex}
            pad={pad}
            isActivePad={activePad === pad.padIndex}
            onSelectPad={handleSelectPad}
          />
        ))}
      </div>

      {!beatboxMode && (
        <div style={styles.controls}>
          {activePad !== null && (
            <span style={styles.selectedLabel}>Selected: Pad {activePad + 1}</span>
          )}
          <button
            style={isRecording ? styles.btnStop : styles.btnRecord}
            onClick={handleRecordForPad}
            disabled={activePad === null}
            title={activePad === null ? 'Click a pad first' : ''}
          >
            {isRecording ? '■ Stop' : '● Record Sound'}
          </button>
          {audioBlob && !isRecording && (
            <>
              <audio controls src={URL.createObjectURL(audioBlob)} style={styles.audio} />
              <button style={styles.btnAssign} onClick={handleAssignClip}>
                Assign to Pad {activePad + 1}
              </button>
            </>
          )}
        </div>
      )}

      {beatboxMode && (
        <div style={styles.controls}>
          <button
            style={isRecording ? styles.btnStop : styles.btnRecord}
            onClick={handleBeatboxRecord}
            disabled={isRecording}
          >
            {isRecording ? '● Recording…' : '● Record 4 Bars'}
          </button>
          {audioBlob && !isRecording && (
            <>
              <audio controls src={URL.createObjectURL(audioBlob)} style={styles.audio} />
              <button style={styles.btnAssign} onClick={handleBeatboxAnalyze} disabled={loading}>
                {loading ? 'Analyzing…' : '🥁 Detect Drums'}
              </button>
            </>
          )}
        </div>
      )}

      {status && <p style={styles.status}>{status}</p>}
    </div>
  )
}

const styles = {
  container: {
    background: '#16213e',
    borderRadius: 10,
    padding: '18px 22px',
    marginBottom: 16,
    border: '1px solid #2a2a4e',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { margin: 0, color: '#e0e0ff', fontSize: 16 },
  modeToggle: { display: 'flex', gap: 4 },
  modeBtn: {
    background: '#2a2a4e',
    color: '#888',
    border: '1px solid #444',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  modeBtnActive: {
    background: '#7c5cbf',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '5px 12px',
    cursor: 'pointer',
    fontSize: 12,
  },
  padGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: 14,
  },
  pad: {
    height: 70,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
    userSelect: 'none',
  },
  padLabel: { color: '#fff', fontSize: 11, fontWeight: 600 },
  padDot: { color: '#fff', fontSize: 8, marginTop: 4 },
  controls: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  selectedLabel: { color: '#aaa', fontSize: 13 },
  btnRecord: {
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnStop: {
    background: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnAssign: {
    background: '#7c5cbf',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  audio: { height: 32 },
  status: { color: '#3d9970', fontSize: 13, marginTop: 8 },
}
