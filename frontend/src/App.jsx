import { useState, useRef, useEffect, useCallback } from 'react'
import TransportBar from './components/TransportBar'
import TrackList from './components/TrackList'
import Recorder from './components/Recorder'
import InstrumentPalette from './components/InstrumentPalette'
import PianoRoll from './components/PianoRoll'
import ArrangementView from './components/ArrangementView'
import ExportPanel from './components/ExportPanel'
import ChordPanel from './components/ChordPanel'
import { useSoundfont } from './hooks/useSoundfont'
import useProjectStore from './store/projectStore'

export default function App() {
  const { tracks, activeTrackId, bpm, setIsPlaying, setPlayheadPosition } = useProjectStore()
  const { playNotes, stopAll, getCtx, loadInstrument } = useSoundfont()
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const loopRef = useRef(false)
  const loopDurationRef = useRef(0)
  const [isLooping, setIsLooping] = useState(false)
  const [loopBars, setLoopBars] = useState(4)
  const [backendStatus, setBackendStatus] = useState('checking')

  const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0]

  useEffect(() => {
    const check = () =>
      fetch('http://localhost:8000/health')
        .then(r => r.json()).then(() => setBackendStatus('ok'))
        .catch(() => setBackendStatus('offline'))
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [])

  // Keep loopDurationRef in sync so the animation loop always reads the latest value
  useEffect(() => {
    loopDurationRef.current = loopBars * 4 * (60 / bpm)
  }, [bpm, loopBars])

  // Schedule all tracks from a given audio-clock startTime (instruments must be pre-loaded)
  const schedulePlayback = useCallback((startTime) => {
    startRef.current = startTime
    const playableTracks = tracks.filter(t => !t.muted && t.notes.length > 0)
    console.log('[schedulePlayback] startTime:', startTime.toFixed(3), 'tracks with notes:', playableTracks.length)
    playableTracks.forEach(track => {
      console.log(`  → scheduling ${track.notes.length} notes for "${track.name}" (${track.instrument})`)
      playNotes(track.notes, track.instrument, track.volume ?? 1, startTime)
    })
  }, [tracks, playNotes])

  const handlePlay = useCallback(async () => {
    const playableTracks = tracks.filter(t => !t.muted && t.notes.length > 0)
    console.log('[handlePlay] playableTracks:', playableTracks.map(t => ({ name: t.name, notes: t.notes.length })))
    console.log('[handlePlay] loopDurationRef:', loopDurationRef.current)
    if (playableTracks.length === 0) { console.warn('[handlePlay] No playable tracks — returning early'); return }
    setIsPlaying(true)
    loopRef.current = isLooping

    const ctx = getCtx()
    console.log('[handlePlay] ctx state:', ctx.state, 'currentTime:', ctx.currentTime)

    // Ensure context is actually running before we schedule
    if (ctx.state === 'suspended') await ctx.resume()

    // Load all instruments once — only real async work happens here
    const instrTracks = playableTracks.filter(t => t.type === 'instrument')
    await Promise.all(instrTracks.map(t => loadInstrument(t.instrument)))

    console.log('[handlePlay] ctx after load:', ctx.state, 'currentTime:', ctx.currentTime)

    // Capture startTime after loading, schedule first iteration
    schedulePlayback(ctx.currentTime + 0.05)

    cancelAnimationFrame(rafRef.current)

    const animate = () => {
      const elapsed = ctx.currentTime - startRef.current
      const dur = loopDurationRef.current
      if (elapsed >= dur) {
        if (loopRef.current) {
          // Anchor next loop exactly to audio clock — no async gap
          schedulePlayback(startRef.current + dur)
        } else {
          setIsPlaying(false)
          setPlayheadPosition(0)
          return
        }
      }
      setPlayheadPosition(Math.max(0, elapsed))
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [schedulePlayback, getCtx, loadInstrument, isLooping, tracks, setIsPlaying, setPlayheadPosition])

  const handleStop = useCallback(() => {
    loopRef.current = false
    cancelAnimationFrame(rafRef.current)
    stopAll()
    setIsPlaying(false)
    setPlayheadPosition(0)
  }, [stopAll, setIsPlaying, setPlayheadPosition])

  const handlePlayTrack = useCallback(async (track) => {
    if (!track.notes.length) return
    await playNotes(track.notes, track.instrument, track.volume ?? 1)
  }, [playNotes])

  return (
    <div style={s.app}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.logo}>
          <div style={s.logoMark}>V</div>
          <div style={s.logoText}>
            <span style={s.logoName}>VOICEtoMIDI</span>
            <span style={s.logoSub}>voice to music</span>
          </div>
        </div>
      </div>

      {/* ── Transport ── */}
      <TransportBar
        onPlay={handlePlay} onStop={handleStop} backendStatus={backendStatus}
        isLooping={isLooping} onToggleLoop={() => { const next = !isLooping; setIsLooping(next); loopRef.current = next }}
        loopBars={loopBars} onSetLoopBars={setLoopBars}
      />

      {/* ── DAW Body ── */}
      <div style={s.body}>
        {/* Track List */}
        <TrackList onPlayTrack={handlePlayTrack} />

        {/* Center: Roll + controls */}
        <div style={s.center}>
          <ArrangementView />
          <PianoRoll />

          {/* Active track controls */}
          <div style={s.controls}>
            <Recorder />
            {activeTrack.type === 'instrument' && <InstrumentPalette />}
            {activeTrack.type === 'instrument' && <ChordPanel />}
          </div>
        </div>

        {/* Right: Export */}
        <div style={s.right}>
          <ExportPanel />
        </div>
      </div>
    </div>
  )
}

const s = {
  app: {
    height: '100vh', display: 'flex', flexDirection: 'column',
    background: 'var(--bg)', color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
  },
  header: {
    height: 44, display: 'flex', alignItems: 'center',
    padding: '0 16px', background: 'var(--surface)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 28, height: 28, background: 'var(--accent)', color: '#fff',
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15,
    boxShadow: '0 0 12px var(--accent-glow)',
  },
  logoText: { display: 'flex', flexDirection: 'column', gap: 0 },
  logoName: {
    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
    letterSpacing: 3, color: 'var(--text)', lineHeight: 1,
  },
  logoSub: {
    fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
    letterSpacing: 1.5, lineHeight: 1,
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  center: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
    gap: 8, padding: 10, overflow: 'auto',
  },
  controls: { display: 'flex', gap: 8, flexShrink: 0 },
  right: {
    width: 240, flexShrink: 0, padding: 10,
    borderLeft: '1px solid var(--border)', overflowY: 'auto',
  },
}
