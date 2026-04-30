"""
HUM to MIDI — Backend API
Run with: uvicorn main:app --reload --port 8000
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from limiter import limiter
from routers.analyze import router as analyze_router
from routers.synthesize import router as synthesize_router
from routers.export import router as export_router

app = FastAPI(
    title="HUM to MIDI API",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(analyze_router)
app.include_router(synthesize_router)
app.include_router(export_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
