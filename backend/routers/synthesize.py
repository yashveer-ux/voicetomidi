import json
from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import Response
from services.synth_engine import synthesize, synthesize_drums
from pydantic import BaseModel
from typing import List, Dict, Optional

router = APIRouter()


class Note(BaseModel):
    note: int
    start_time: float
    duration: float
    velocity: int = 80


class SynthRequest(BaseModel):
    notes: List[Note]
    instrument: str = "piano"
    bpm: float = 120.0


@router.post("/synthesize")
async def synthesize_route(req: SynthRequest):
    """Render MIDI notes to WAV audio."""
    valid_instruments = {"piano", "guitar", "synth", "strings"}
    if req.instrument not in valid_instruments:
        raise HTTPException(status_code=400, detail=f"Invalid instrument. Choose from: {valid_instruments}")

    notes_dicts = [n.model_dump() for n in req.notes]
    wav_bytes = synthesize(notes_dicts, instrument=req.instrument, bpm=req.bpm)
    return Response(content=wav_bytes, media_type="audio/wav")
