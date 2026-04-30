from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from services.audio_analyzer import analyze_audio
from limiter import limiter

router = APIRouter()

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10MB


@router.post("/analyze")
@limiter.limit("10/minute")
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    bpm: float = Form(120.0),
):
    if file.content_type and not file.content_type.startswith("audio"):
        raise HTTPException(status_code=400, detail="File must be an audio recording")

    audio_bytes = await file.read(MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio clip too short")

    notes = analyze_audio(audio_bytes, bpm=bpm)
    return {"notes": notes, "count": len(notes)}
