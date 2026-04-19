const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res
}

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res
}

// Analyze voice recording → MIDI notes
export async function analyzeAudio(audioBlob, bpm = 120) {
  const form = new FormData()
  form.append('file', audioBlob, 'recording.wav')
  form.append('bpm', String(bpm))
  const res = await postForm('/analyze', form)
  return res.json() // { notes, count }
}

// Synthesize notes → WAV blob
export async function synthesizeNotes(notes, instrument = 'piano', bpm = 120) {
  const res = await post('/synthesize', { notes, instrument, bpm })
  const arrayBuffer = await res.arrayBuffer()
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// Export full project
export async function exportProject(notes, drumHits, instrument, bpm, format) {
  const res = await post('/export', { notes, drum_hits: drumHits, instrument, bpm, format })
  return res.blob()
}

// Save project
export async function saveProject(state) {
  const res = await post('/project/save', state)
  return res.json() // { project_id }
}

// List projects
export async function listProjects() {
  const res = await fetch(`${BASE}/project/list`)
  return res.json()
}

// Load project
export async function loadProject(projectId) {
  const res = await fetch(`${BASE}/project/${projectId}`)
  if (!res.ok) throw new Error('Project not found')
  return res.json()
}

// Create a Stripe Checkout session for a paid export
export async function createCheckout(format) {
  const res = await post('/checkout', { format })
  return res.json() // { session_id, checkout_url }
}

// Verify a paid Stripe session and download the exported file
export async function verifiedExport(sessionId, format, notes, bpm, instrument) {
  const res = await post('/export/verified', {
    session_id: sessionId,
    format,
    notes,
    bpm,
    instrument,
  })
  return res.blob()
}
