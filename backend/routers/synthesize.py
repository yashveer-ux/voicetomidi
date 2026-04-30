from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from services.synth_engine import synthesize
from pydantic import BaseModel, Field
from typing import List
from limiter import limiter

router = APIRouter()

VALID_INSTRUMENTS = {"piano", "guitar", "synth", "strings"}


class Note(BaseModel):
    note: int = Field(ge=0, le=127)
    start_time: float = Field(ge=0, le=300)
    duration: float = Field(ge=0.01, le=30)
    velocity: int = Field(default=80, ge=0, le=127)


class SynthRequest(BaseModel):
    notes: List[Note] = Field(max_length=500)
    instrument: str = "piano"
    bpm: float = Field(default=120.0, ge=20, le=300)


@router.post("/synthesize")
@limiter.limit("20/minute")
async def synthesize_route(request: Request, req: SynthRequest):
    if req.instrument not in VALID_INSTRUMENTS:
        raise HTTPException(status_code=400, detail=f"Invalid instrument. Choose from: {VALID_INSTRUMENTS}")

    notes_dicts = [n.model_dump() for n in req.notes]
    wav_bytes = synthesize(notes_dicts, instrument=req.instrument, bpm=req.bpm)
    return Response(content=wav_bytes, media_type="audio/wav")
