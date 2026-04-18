from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
from services.synth_engine import synthesize
from services.export_service import export_wav, export_mp3, export_midi
import os
import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

_used_sessions: set = set()

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


class VerifiedExportRequest(BaseModel):
    session_id: str
    format: str  # "wav" | "mp3" | "midi"
    notes: List[Note] = []
    instrument: str = "piano"
    bpm: float = 120.0


@router.post("/export/verified")
async def export_verified(req: VerifiedExportRequest):
    # Verify payment with Stripe
    session = stripe.checkout.Session.retrieve(req.session_id)
    if session.payment_status != "paid":
        raise HTTPException(status_code=402, detail="Payment required")

    # Prevent replay
    if req.session_id in _used_sessions:
        raise HTTPException(status_code=409, detail="Session already used")
    _used_sessions.add(req.session_id)

    # Generate file (same logic as /export)
    notes_dicts = [n.model_dump() for n in req.notes]

    if req.format == "midi":
        midi_bytes = export_midi(notes_dicts, [], bpm=req.bpm)
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": "attachment; filename=export.mid"},
        )

    wav_bytes = synthesize(notes_dicts, instrument=req.instrument, bpm=req.bpm)

    if req.format == "mp3":
        mp3_bytes = export_mp3(wav_bytes, b"")
        if mp3_bytes is None:
            raise HTTPException(
                status_code=422,
                detail="MP3 export requires ffmpeg.",
            )
        return Response(
            content=mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": "attachment; filename=export.mp3"},
        )

    wav_out = export_wav(wav_bytes, b"")
    return Response(
        content=wav_out,
        media_type="audio/wav",
        headers={"Content-Disposition": "attachment; filename=export.wav"},
    )
