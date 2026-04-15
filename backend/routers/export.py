from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from services.synth_engine import synthesize
from services.export_service import export_wav, export_mp3, export_midi

router = APIRouter()


class Note(BaseModel):
    note: int
    start_time: float
    duration: float
    velocity: int = 80


class ExportRequest(BaseModel):
    notes: List[Note] = []
    instrument: str = "piano"
    bpm: float = 120.0
    format: str = "wav"  # "wav" | "mp3" | "midi"


@router.post("/export")
async def export_route(req: ExportRequest):
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
            raise HTTPException(
                status_code=422,
                detail="MP3 export requires ffmpeg. Install it with: brew install ffmpeg",
            )
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
