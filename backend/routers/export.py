from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List
from services.synth_engine import synthesize
from services.export_service import export_wav, export_mp3, export_midi
from limiter import rate_limit

router = APIRouter()

VALID_INSTRUMENTS = {"piano", "guitar", "synth", "strings"}
VALID_FORMATS = {"wav", "mp3", "midi"}


class Note(BaseModel):
    note: int = Field(ge=0, le=127)
    start_time: float = Field(ge=0, le=300)
    duration: float = Field(ge=0.01, le=30)
    velocity: int = Field(default=80, ge=0, le=127)


class ExportRequest(BaseModel):
    notes: List[Note] = Field(default=[], max_length=500)
    instrument: str = "piano"
    bpm: float = Field(default=120.0, ge=20, le=300)
    format: str = "wav"


@router.post("/export")
@rate_limit(10)
async def export_route(request: Request, req: ExportRequest):
    if req.instrument not in VALID_INSTRUMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid instrument. Choose from: {VALID_INSTRUMENTS}")
    if req.format not in VALID_FORMATS:
        raise HTTPException(status_code=400, detail=f"Invalid format. Choose from: {VALID_FORMATS}")

    notes_dicts = [n.model_dump() for n in req.notes]

    if req.format == "midi":
        midi_bytes = export_midi(notes_dicts, [], bpm=req.bpm)
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": "attachment; filename=hummed_export.mid"},
        )

    wav_bytes_melody = synthesize(notes_dicts, instrument=req.instrument, bpm=req.bpm)

    if req.format == "mp3":
        mp3_bytes = export_mp3(wav_bytes_melody, b"")
        if mp3_bytes is None:
            raise HTTPException(status_code=422, detail="MP3 export requires ffmpeg.")
        return Response(
            content=mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=hummed_export.mp3"},
        )

    wav_bytes = export_wav(wav_bytes_melody, b"")
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=hummed_export.wav"},
    )
