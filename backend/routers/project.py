import os
import json
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

router = APIRouter()

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "..", "projects")
os.makedirs(PROJECTS_DIR, exist_ok=True)


class ProjectState(BaseModel):
    name: str = "Untitled"
    bpm: float = 120.0
    instrument: str = "piano"
    notes: List[Dict[str, Any]] = []


@router.post("/project/save")
async def save_project(state: ProjectState):
    project_id = str(uuid.uuid4())[:8]
    path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    with open(path, "w") as f:
        json.dump(state.model_dump(), f, indent=2)
    return {"project_id": project_id, "message": "Project saved"}


@router.get("/project/list")
async def list_projects():
    projects = []
    for fname in os.listdir(PROJECTS_DIR):
        if fname.endswith(".json"):
            pid = fname.replace(".json", "")
            fpath = os.path.join(PROJECTS_DIR, fname)
            with open(fpath) as f:
                data = json.load(f)
            projects.append({"project_id": pid, "name": data.get("name", "Untitled")})
    return {"projects": projects}


@router.get("/project/{project_id}")
async def load_project(project_id: str):
    path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Project not found")
    with open(path) as f:
        data = json.load(f)
    return data
