import useProjectStore from '../store/projectStore'

const MIDI_MAX = 96

const CHORDS = [
  { label: 'Major',    short: 'Maj',   intervals: [0, 4, 7] },
  { label: 'Minor',    short: 'Min',   intervals: [0, 3, 7] },
  { label: 'Major 7',  short: 'Maj7',  intervals: [0, 4, 7, 11] },
  { label: 'Minor 7',  short: 'Min7',  intervals: [0, 3, 7, 10] },
  { label: 'Dom 7',    short: 'Dom7',  intervals: [0, 4, 7, 10] },
  { label: 'Major 9',  short: 'Maj9',  intervals: [0, 4, 7, 11, 14] },
  { label: 'Minor 9',  short: 'Min9',  intervals: [0, 3, 7, 10, 14] },
  { label: 'Dom 9',    short: 'Dom9',  intervals: [0, 4, 7, 10, 14] },
  { label: 'Dim',      short: 'Dim',   intervals: [0, 3, 6] },
  { label: 'Aug',      short: 'Aug',   intervals: [0, 4, 8] },
  { label: 'Sus 2',    short: 'Sus2',  intervals: [0, 2, 7] },
  { label: 'Sus 4',    short: 'Sus4',  intervals: [0, 5, 7] },
  { label: 'Dim 7',    short: 'Dim7',  intervals: [0, 3, 6, 9] },
  { label: 'Half-Dim', short: 'HlfD',  intervals: [0, 3, 6, 10] },
  { label: 'Aug 7',    short: 'Aug7',  intervals: [0, 4, 8, 10] },
  { label: '6th',      short: '6th',   intervals: [0, 4, 7, 9] },
  { label: 'Min 6',    short: 'Min6',  intervals: [0, 3, 7, 9] },
  { label: 'Add 9',    short: 'Add9',  intervals: [0, 4, 7, 14] },
]

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const noteName = midi => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`

export default function ChordPanel() {
  const { tracks, activeTrackId, selectedNoteIndices, setTrackNotes } = useProjectStore()
  const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0]

  const hasSelection = selectedNoteIndices.length > 0
  const rootNote = hasSelection ? activeTrack.notes[selectedNoteIndices[0]] : null
  const rootName = rootNote ? noteName(rootNote.note) : null

  const applyChord = (intervals) => {
    if (!hasSelection || !rootNote) return
    const notes = [...activeTrack.notes]

    // For each selected note, replace it with the full chord
    const toAdd = []
    selectedNoteIndices.forEach(idx => {
      const root = notes[idx]
      if (!root) return
      intervals.forEach(semitones => {
        if (semitones === 0) return // root already exists
        const midi = root.note + semitones
        if (midi > MIDI_MAX) return
        toAdd.push({
          note: midi,
          start_time: root.start_time,
          duration: root.duration,
          velocity: root.velocity ?? 80,
        })
      })
    })

    setTrackNotes(activeTrackId, [...notes, ...toAdd])
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.title}>CHORD</span>
        <span style={s.sub}>
          {hasSelection ? `Root: ${rootName}` : 'select a note'}
        </span>
      </div>
      <div style={s.grid}>
        {CHORDS.map(chord => (
          <button
            key={chord.short}
            style={{
              ...s.btn,
              opacity: hasSelection ? 1 : 0.35,
              cursor: hasSelection ? 'pointer' : 'default',
            }}
            onClick={() => applyChord(chord.intervals)}
            disabled={!hasSelection}
            title={`${chord.label} (${chord.intervals.map(i => i > 0 ? `+${i}` : '0').join(', ')} semitones)`}
          >
            {chord.short}
          </button>
        ))}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '12px 14px', minWidth: 220,
  },
  header: { marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 },
  title: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' },
  sub: { fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' },
  grid: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  btn: {
    background: 'var(--surface-3)', color: 'var(--purple)',
    border: '1px solid var(--border-2)', borderRadius: 'var(--radius)',
    padding: '5px 9px', fontWeight: 700, fontSize: 10,
    fontFamily: 'var(--font-mono)', letterSpacing: 0.5,
    transition: 'all 0.12s',
  },
}
