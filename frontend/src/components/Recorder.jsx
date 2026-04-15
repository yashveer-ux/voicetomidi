import { useState, useRef, useEffect } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { analyzeAudio } from '../api/client'
import useProjectStore from '../store/projectStore'

export default function Recorder() {
  const { isRecording, audioBlob, error, startRecording, stopRecording, streamRef } = useRecorder()
  const { bpm, activeTrackId, setTrackNotes } = useProjectStore()

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(null) // { notes }
  const fileRef = useRef()
  const canvasRef = useRef()
  const animRef = useRef()

  const analyze = async (blob) => {
    setLoading(true)
    setStatus('Analyzing…')
    try {
      const r = await analyzeAudio(blob, bpm)
      if (r.count) {
        setPending({ notes: r.notes })
        setStatus(`✓ ${r.count} notes detected`)
      } else {
        setStatus('No notes detected — try humming more clearly')
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFileImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await analyze(file)
    e.target.value = ''
  }

  const handleRecord = () => {
    setPending(null)
    setStatus('')
    startRecording()
  }

  const handleStop = async () => {
    stopRecording()
  }

  const handleSend = () => {
    if (!pending) return
    setTrackNotes(activeTrackId, pending.notes)
    setPending(null)
    setStatus('Sent to piano roll')
  }

  // Auto-analyze when audioBlob is ready (after stop)
  const prevBlobRef = useRef(null)
  if (audioBlob && audioBlob !== prevBlobRef.current) {
    prevBlobRef.current = audioBlob
    analyze(audioBlob)
  }

  // Live oscilloscope during recording
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    if (!isRecording || !streamRef.current) {
      // draw idle flat line when not recording
      if (!audioBlob) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 1
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.stroke()
      }
      return
    }

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    audioCtx.createMediaStreamSource(streamRef.current).connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(buf)
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.beginPath()
      ctx.strokeStyle = '#ff5c1a'
      ctx.lineWidth = 1.5
      const sliceW = W / buf.length
      let x = 0
      for (let i = 0; i < buf.length; i++) {
        const y = (buf[i] / 255) * H
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        x += sliceW
      }
      ctx.stroke()
    }
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      audioCtx.close()
    }
  }, [isRecording])

  // Static waveform after recording
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioBlob) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const draw = async () => {
      try {
        const arrayBuf = await audioBlob.arrayBuffer()
        const audioCtx = new AudioContext()
        const decoded = await audioCtx.decodeAudioData(arrayBuf)
        audioCtx.close()
        const data = decoded.getChannelData(0)
        const W = canvas.width, H = canvas.height
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, W, H)
        ctx.beginPath()
        ctx.strokeStyle = '#00e5d4'
        ctx.lineWidth = 1
        const step = Math.max(1, Math.floor(data.length / W))
        for (let i = 0; i < W; i++) {
          let min = 1, max = -1
          for (let j = 0; j < step; j++) {
            const v = data[i * step + j] ?? 0
            if (v < min) min = v
            if (v > max) max = v
          }
          ctx.moveTo(i, (1 + max) / 2 * H)
          ctx.lineTo(i, (1 + min) / 2 * H)
        }
        ctx.stroke()
      } catch (_) { /* decode failed, leave canvas as-is */ }
    }
    draw()
  }, [audioBlob])

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>🎤 Record Melody</span>
        <span style={s.sub}>hum or import audio</span>
      </div>

      <div style={s.controls}>
        {!isRecording ? (
          <button style={s.recBtn} onClick={handleRecord}>
            <span style={s.recDot} /> Record
          </button>
        ) : (
          <button style={s.stopBtn} onClick={handleStop}>
            <span style={s.stopSq} /> Stop
          </button>
        )}

        <label style={s.importBtn} title="Import melody audio file">
          ↑ Import Audio
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.flac" onChange={handleFileImport} style={{ display: 'none' }} />
        </label>

        {audioBlob && !isRecording && (
          <audio controls src={URL.createObjectURL(audioBlob)} style={s.audio} />
        )}
      </div>

      <canvas ref={canvasRef} style={s.canvas} />

      {pending && (
        <button style={s.sendBtn} onClick={handleSend}>
          ↓ Send to Piano Roll
        </button>
      )}

      {error && <p style={s.err}>{error}</p>}
      {(status || loading) && (
        <p style={{ ...s.status, color: status.startsWith('✓') ? 'var(--teal)' : status.startsWith('Error') ? '#e74c3c' : 'var(--text-muted)' }}>
          {loading ? '⟳ ' : ''}{status}
        </p>
      )}
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
  controls: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  recBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '7px 14px', fontWeight: 700, fontSize: 12,
    boxShadow: '0 0 10px var(--accent-glow)',
  },
  stopBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'var(--surface-3)', color: 'var(--text)',
    border: '1px solid var(--border-2)', borderRadius: 'var(--radius)',
    padding: '7px 14px', fontWeight: 700, fontSize: 12,
  },
  recDot: { width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'none' },
  stopSq: { width: 8, height: 8, background: 'var(--text)', borderRadius: 1 },
  importBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--surface-3)', color: 'var(--teal)',
    border: '1px solid var(--border-2)', borderRadius: 'var(--radius)',
    padding: '7px 12px', fontWeight: 600, fontSize: 11,
    cursor: 'pointer', fontFamily: 'var(--font-ui)',
  },
  audio: { height: 28, flex: 1, minWidth: 0 },
  canvas: {
    display: 'block', width: '100%', height: 52,
    marginTop: 10, borderRadius: 'var(--radius)',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
  },
  sendBtn: {
    marginTop: 8, width: '100%',
    background: 'var(--teal)', color: '#05050f',
    border: 'none', borderRadius: 'var(--radius)',
    padding: '7px 0', fontWeight: 700, fontSize: 12,
    cursor: 'pointer', letterSpacing: 0.3,
  },
  err: { color: '#e74c3c', fontSize: 11, marginTop: 8 },
  status: { fontSize: 11, marginTop: 8, fontFamily: 'var(--font-mono)' },
}
