import { useRef, useCallback } from 'react'

// Synthesised drum sounds via Web Audio API — no soundfont needed
function kick(ctx, time, vel = 1) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.35)
  gain.gain.setValueAtTime(vel, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35)
  osc.start(time); osc.stop(time + 0.36)
}

function snare(ctx, time, vel = 1) {
  // White noise burst
  const len = Math.ceil(ctx.sampleRate * 0.18)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource(); noise.buffer = buf
  const filt = ctx.createBiquadFilter()
  filt.type = 'bandpass'; filt.frequency.value = 2000; filt.Q.value = 0.7
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(vel * 0.65, time)
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  noise.connect(filt); filt.connect(ng); ng.connect(ctx.destination); noise.start(time)
  // Body tone
  const osc = ctx.createOscillator(); const og = ctx.createGain()
  osc.frequency.value = 200
  og.gain.setValueAtTime(vel * 0.4, time)
  og.gain.exponentialRampToValueAtTime(0.001, time + 0.1)
  osc.connect(og); og.connect(ctx.destination); osc.start(time); osc.stop(time + 0.18)
}

function hihat(ctx, time, open, vel = 1) {
  const dur = open ? 0.35 : 0.06
  const len = Math.ceil(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vel * 0.35, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur)
  src.connect(hp); hp.connect(gain); gain.connect(ctx.destination); src.start(time)
}

function tom(ctx, time, freq, vel = 1) {
  const osc = ctx.createOscillator(); const gain = ctx.createGain()
  osc.frequency.setValueAtTime(freq, time)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, time + 0.22)
  gain.gain.setValueAtTime(vel * 0.85, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22)
  osc.connect(gain); gain.connect(ctx.destination); osc.start(time); osc.stop(time + 0.23)
}

function crash(ctx, time, vel = 1) {
  const len = Math.ceil(ctx.sampleRate * 0.8)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource(); src.buffer = buf
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vel * 0.25, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8)
  src.connect(hp); hp.connect(gain); gain.connect(ctx.destination); src.start(time)
}

// Map MIDI drum note → synth function
function playDrumNote(ctx, midi, time, vel = 1) {
  const v = Math.max(0.01, Math.min(1, vel / 127))
  switch (midi) {
    case 36: return kick(ctx, time, v)
    case 38: case 40: return snare(ctx, time, v)
    case 42: return hihat(ctx, time, false, v)
    case 46: return hihat(ctx, time, true, v)
    case 45: return tom(ctx, time, 160, v)
    case 50: return tom(ctx, time, 280, v)
    case 49: case 57: return crash(ctx, time, v)
    case 51: case 59: return hihat(ctx, time, true, v * 0.7) // ride ≈ open hihat
    default: return tom(ctx, time, 200, v)
  }
}

export function useDrumSynth() {
  const ctxRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  // Preview a single drum hit immediately (used on click)
  const previewHit = useCallback((midi, velocity = 100) => {
    const ctx = getCtx()
    playDrumNote(ctx, midi, ctx.currentTime + 0.01, velocity)
  }, [getCtx])

  // Schedule a full sequence of drum notes
  const playSequence = useCallback((notes, startTime, volume = 1.0) => {
    const ctx = getCtx()
    notes.forEach(n => {
      playDrumNote(ctx, n.note, startTime + n.start_time, (n.velocity || 100) * volume)
    })
    const maxEnd = notes.length ? Math.max(...notes.map(n => n.start_time + n.duration)) : 0
    return maxEnd
  }, [getCtx])

  return { previewHit, playSequence, getCtx }
}
