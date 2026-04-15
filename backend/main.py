"""
Hummed — Backend API
Run with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocket
import asyncio

from routers.analyze import router as analyze_router
from routers.synthesize import router as synthesize_router
from routers.export import router as export_router
from routers.project import router as project_router

app = FastAPI(title="Hummed API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(synthesize_router)
app.include_router(export_router)
app.include_router(project_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.websocket("/ws/playback")
async def playback_ws(websocket: WebSocket):
    """
    WebSocket for playback position sync.
    Client sends: {"action": "play", "bpm": 120, "total_beats": 16}
    Server streams: {"beat": 1, "position": 0.5}
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "play":
                bpm = float(data.get("bpm", 120))
                total_beats = int(data.get("total_beats", 16))
                beat_duration = 60.0 / bpm

                for beat in range(total_beats):
                    await websocket.send_json({"beat": beat, "position": beat / total_beats})
                    await asyncio.sleep(beat_duration)

                await websocket.send_json({"beat": total_beats, "position": 1.0, "done": True})

            elif action == "stop":
                await websocket.send_json({"stopped": True})

    except Exception:
        pass
