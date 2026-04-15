import { useRef, useState } from 'react'

/**
 * Rotary knob — drag up to increase, drag down to decrease.
 * Sweep: 270° from 7 o'clock (min) to 5 o'clock (max) passing through 12.
 */
export default function Knob({ value, onChange, min = 0, max = 1.5, size = 30, color = '#00e5d4', label = '' }) {
  const dragRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  const frac   = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const cx     = size / 2
  const cy     = size / 2
  const r      = size / 2 - 3.5
  const stroke = 2.5

  // Sweep from 225° to 495° (= 225° + 270°) clockwise from 12 o'clock
  const startDeg = 225
  const totalDeg = 270
  const endDeg   = startDeg + frac * totalDeg

  const toXY = deg => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
  }

  const start = toXY(startDeg)
  const end   = toXY(endDeg)
  const large = frac * totalDeg > 180 ? 1 : 0

  // Indicator dot position
  const ind = toXY(endDeg)

  const handleMouseDown = e => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startY: e.clientY, startValue: value }

    const onMove = e => {
      if (!dragRef.current) return
      const dy  = dragRef.current.startY - e.clientY   // up = positive
      const raw = dragRef.current.startValue + (dy / 80) * (max - min)
      onChange(Math.round(Math.max(min, Math.min(max, raw)) * 100) / 100)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const pct = Math.round(frac * 100)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}
      title={`${label}: ${pct}%`}
    >
      <svg
        width={size} height={size}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'ns-resize', display: 'block' }}
      >
        {/* Track (full 270° arc, dimmed) */}
        <path
          d={`M ${toXY(startDeg).x} ${toXY(startDeg).y} A ${r} ${r} 0 1 1 ${toXY(startDeg + 269.9).x} ${toXY(startDeg + 269.9).y}`}
          fill="none"
          stroke="#1e1e3a"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {frac > 0.005 && (
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`}
            fill="none"
            stroke={hovered ? '#fff' : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.15s' }}
          />
        )}
        {/* Center circle */}
        <circle cx={cx} cy={cy} r={r - stroke - 1} fill="#0a0a1e" />
        {/* Indicator line from center to arc */}
        <line
          x1={cx} y1={cy} x2={ind.x} y2={ind.y}
          stroke={hovered ? '#fff' : color}
          strokeWidth={1.5}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.15s' }}
        />
      </svg>
      {hovered && (
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)', lineHeight: 1,
        }}>
          {pct}%
        </span>
      )}
    </div>
  )
}
