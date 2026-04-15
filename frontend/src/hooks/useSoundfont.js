import { useRef, useCallback } from 'react'
import Soundfont from 'soundfont-player'

// Maps our instrument names to Soundfont.js instrument names (MusyngKite samples)
const INSTRUMENT_MAP = {
  piano:   'acoustic_grand_piano',
  guitar:  'acoustic_guitar_nylon',
  synth:   'lead_2_sawtooth',
  strings: 'string_ensemble_1',
  drums:   'percussion',         // GM percussion channel
}

export function useSoundfont() {
  const ctxRef = useRef(null)
  const cacheRef = useRef({}) // { instrumentName: Soundfont player }
  const activeNodesRef = useRef([])

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  const loadInstrument = useCallback(async (instrumentKey) => {
    const name = INSTRUMENT_MAP[instrumentKey] || INSTRUMENT_MAP.piano
    if (cacheRef.current[name]) return cacheRef.current[name]

    const ctx = getCtx()
    const player = await Soundfont.instrument(ctx, name, {
      format: 'mp3',
      soundfont: 'MusyngKite',
    })
    cacheRef.current[name] = player
    return player
  }, [])

  const playNotes = useCallback(async (notes, instrumentKey = 'piano', volume = 1.0, startTime = null) => {
    const ctx = getCtx()
    const player = await loadInstrument(instrumentKey)
    const t = startTime !== null ? startTime : ctx.currentTime + 0.05
    console.log(`[playNotes] instrument=${instrumentKey} ctx.state=${ctx.state} t=${t.toFixed(3)} ctx.now=${ctx.currentTime.toFixed(3)} notes=${notes.length}`)

    const nodes = notes.map(note => {
      const noteTime = t + note.start_time
      return player.play(note.note, noteTime, {
        duration: Math.max(note.duration, 0.1),
        gain: ((note.velocity || 80) / 127) * volume,
      })
    })

    activeNodesRef.current = nodes
    const maxEnd = Math.max(...notes.map(n => n.start_time + n.duration))
    return { startTime: t, duration: maxEnd }
  }, [loadInstrument])

  const stopAll = useCallback(() => {
    activeNodesRef.current.forEach(n => { try { n?.stop?.() } catch (_) {} })
    activeNodesRef.current = []
  }, [])

  return { playNotes, stopAll, getCtx, loadInstrument }
}
