import { useRef, useCallback, useEffect } from 'react'

export function useMetronome(bpm, isOn) {
  const ctxRef = useRef(null)
  const nextBeatTimeRef = useRef(0)
  const intervalRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return ctxRef.current
  }, [])

  const scheduleClick = useCallback((time, isDownbeat) => {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.frequency.value = isDownbeat ? 1000 : 800
    gain.gain.setValueAtTime(0.3, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    osc.start(time)
    osc.stop(time + 0.05)
  }, [getCtx])

  const startMetronome = useCallback(() => {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()

    let beat = 0
    nextBeatTimeRef.current = ctx.currentTime + 0.1

    const schedule = () => {
      const lookAhead = 0.1
      while (nextBeatTimeRef.current < ctx.currentTime + lookAhead) {
        scheduleClick(nextBeatTimeRef.current, beat % 4 === 0)
        nextBeatTimeRef.current += 60.0 / bpm
        beat++
      }
    }

    intervalRef.current = setInterval(schedule, 25)
  }, [bpm, getCtx, scheduleClick])

  const stopMetronome = useCallback(() => {
    clearInterval(intervalRef.current)
  }, [])

  useEffect(() => {
    if (isOn) {
      startMetronome()
    } else {
      stopMetronome()
    }
    return stopMetronome
  }, [isOn, bpm, startMetronome, stopMetronome])
}
