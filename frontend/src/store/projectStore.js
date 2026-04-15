import { create } from 'zustand'

const TRACK_COLORS = [
  '#7c5cbf', '#e74c3c', '#2ecc71', '#3498db',
  '#e67e22', '#1abc9c', '#e91e63', '#f1c40f',
]

let trackCounter = 3

function makeTrack(id, name, instrument, color) {
  return {
    id,
    name,
    type: 'instrument',
    instrument,    // 'piano' | 'guitar' | 'synth' | 'strings'
    notes: [],
    color,
    muted: false,
    volume: 1.0,
  }
}

const DEFAULT_TRACKS = [
  makeTrack('track-1', 'Melody', 'piano', TRACK_COLORS[0]),
]

const useProjectStore = create((set, get) => ({
  // Project meta
  projectName: 'Untitled',
  projectId: null,

  // Transport
  bpm: 120,
  isPlaying: false,
  isMetronomeOn: false,
  playheadPosition: 0,

  // Piano roll selection (indices into active track's notes array)
  selectedNoteIndices: [],
  setSelectedNoteIndices: (indices) => set({ selectedNoteIndices: indices }),

  // Multi-track
  tracks: DEFAULT_TRACKS,
  activeTrackId: 'track-1',

  // Setters
  setBpm: (bpm) => set({ bpm }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsMetronomeOn: (isMetronomeOn) => set({ isMetronomeOn }),
  setPlayheadPosition: (playheadPosition) => set({ playheadPosition }),
  setProjectName: (projectName) => set({ projectName }),
  setProjectId: (projectId) => set({ projectId }),
  setActiveTrackId: (activeTrackId) => set({ activeTrackId }),

  // Active track helpers
  getActiveTrack: () => {
    const { tracks, activeTrackId } = get()
    return tracks.find(t => t.id === activeTrackId) || tracks[0]
  },

  // Track CRUD
  addTrack: () => {
    const { tracks } = get()
    const id = `track-${trackCounter++}`
    const color = TRACK_COLORS[(tracks.length) % TRACK_COLORS.length]
    const name = `Track ${tracks.length + 1}`
    const newTrack = makeTrack(id, name, 'piano', color)
    set({ tracks: [...tracks, newTrack], activeTrackId: id })
  },

  removeTrack: (id) => {
    const { tracks, activeTrackId } = get()
    if (tracks.length <= 1) return
    const newTracks = tracks.filter(t => t.id !== id)
    const newActive = id === activeTrackId ? newTracks[0].id : activeTrackId
    set({ tracks: newTracks, activeTrackId: newActive })
  },

  updateTrack: (id, updates) =>
    set(state => ({
      tracks: state.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),

  toggleMute: (id) =>
    set(state => ({
      tracks: state.tracks.map(t => t.id === id ? { ...t, muted: !t.muted } : t)
    })),

  // Notes on active track
  setTrackNotes: (trackId, notes) =>
    set(state => ({
      tracks: state.tracks.map(t => t.id === trackId ? { ...t, notes } : t)
    })),

  updateNote: (trackId, index, updates) =>
    set(state => ({
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, notes: t.notes.map((n, i) => i === index ? { ...n, ...updates } : n) }
          : t
      )
    })),

  deleteNote: (trackId, index) =>
    set(state => ({
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? { ...t, notes: t.notes.filter((_, i) => i !== index) }
          : t
      )
    })),

  reset: () =>
    set({
      tracks: DEFAULT_TRACKS.map(t => ({ ...t, notes: [] })),
      activeTrackId: 'track-1',
      projectName: 'Untitled',
      projectId: null,
      isPlaying: false,
      playheadPosition: 0,
    }),
}))

export default useProjectStore
