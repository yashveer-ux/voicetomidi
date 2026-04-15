import { describe, it, expect, beforeEach } from 'vitest'
import useProjectStore from './projectStore'

const getState = () => useProjectStore.getState()

describe('projectStore', () => {
  beforeEach(() => {
    getState().reset()
  })

  // ── Initial state ────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('has one default Melody track', () => {
      expect(getState().tracks).toHaveLength(1)
      expect(getState().tracks[0].name).toBe('Melody')
      expect(getState().tracks[0].instrument).toBe('piano')
      expect(getState().tracks[0].notes).toEqual([])
    })

    it('bpm defaults to 120', () => {
      expect(getState().bpm).toBe(120)
    })

    it('activeTrackId matches the default track id', () => {
      expect(getState().activeTrackId).toBe(getState().tracks[0].id)
    })
  })

  // ── Track management ─────────────────────────────────────────────────────
  describe('track management', () => {
    it('addTrack increases track count by 1 and sets new track active', () => {
      getState().addTrack()
      expect(getState().tracks).toHaveLength(2)
      const newTrack = getState().tracks[1]
      expect(getState().activeTrackId).toBe(newTrack.id)
      expect(newTrack.notes).toEqual([])
    })

    it('removeTrack removes the track and switches active to the remaining track', () => {
      getState().addTrack()
      const [first, second] = getState().tracks
      getState().removeTrack(second.id)
      expect(getState().tracks).toHaveLength(1)
      expect(getState().activeTrackId).toBe(first.id)
    })

    it('removeTrack is a no-op when only one track remains', () => {
      const [only] = getState().tracks
      getState().removeTrack(only.id)
      expect(getState().tracks).toHaveLength(1)
    })

    it('updateTrack changes the track name', () => {
      const [track] = getState().tracks
      getState().updateTrack(track.id, { name: 'Renamed' })
      expect(getState().tracks[0].name).toBe('Renamed')
    })

    it('toggleMute flips the muted boolean', () => {
      const [track] = getState().tracks
      expect(getState().tracks[0].muted).toBe(false)
      getState().toggleMute(track.id)
      expect(getState().tracks[0].muted).toBe(true)
      getState().toggleMute(track.id)
      expect(getState().tracks[0].muted).toBe(false)
    })
  })

  // ── Note CRUD ────────────────────────────────────────────────────────────
  describe('note CRUD', () => {
    const NOTE_A = { note: 60, start_time: 0.0, duration: 0.5, velocity: 80 }
    const NOTE_B = { note: 64, start_time: 0.5, duration: 0.5, velocity: 90 }

    it('setTrackNotes replaces all notes for a track', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      expect(getState().tracks[0].notes).toEqual([NOTE_A, NOTE_B])
    })

    it('updateNote mutates only the specified note field, leaving others unchanged', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      getState().updateNote(track.id, 0, { velocity: 100 })
      expect(getState().tracks[0].notes[0].velocity).toBe(100)
      expect(getState().tracks[0].notes[1].velocity).toBe(90) // unchanged
    })

    it('deleteNote removes note at index 0 and shifts remaining notes', () => {
      const [track] = getState().tracks
      getState().setTrackNotes(track.id, [NOTE_A, NOTE_B])
      getState().deleteNote(track.id, 0)
      expect(getState().tracks[0].notes).toHaveLength(1)
      expect(getState().tracks[0].notes[0]).toEqual(NOTE_B)
    })
  })

  // ── Transport ────────────────────────────────────────────────────────────
  describe('transport', () => {
    it('setBpm updates bpm', () => {
      getState().setBpm(140)
      expect(getState().bpm).toBe(140)
    })

    it('setPlayheadPosition updates playheadPosition', () => {
      getState().setPlayheadPosition(2.5)
      expect(getState().playheadPosition).toBe(2.5)
    })

    it('setSelectedNoteIndices updates selectedNoteIndices', () => {
      getState().setSelectedNoteIndices([0, 1])
      expect(getState().selectedNoteIndices).toEqual([0, 1])
    })
  })
})
