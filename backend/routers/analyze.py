from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from services.audio_analyzer import analyze_audio

router = APIRouter()


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    bpm: float = Form(120.0),
):
    """Analyze a voice recording and return MIDI notes."""
    # Accept any audio content-type — pydub handles format detection via ffmpeg
    if file.content_type and not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be an audio recording")

    audio_bytes = await file.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio clip too short")

    notes = analyze_audio(audio_bytes, bpm=bpm)
    return {"notes": notes, "count": len(notes)}
