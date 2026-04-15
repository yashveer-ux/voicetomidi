import pytest
import pytest_asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from httpx import AsyncClient, ASGITransport
from main import app
import routers.project as project_router


@pytest_asyncio.fixture
async def async_client(tmp_path, monkeypatch):
    """Async HTTP client wired to the FastAPI app in-process.
    Projects are written to a temp dir so tests don't pollute backend/projects/."""
    monkeypatch.setattr(project_router, "PROJECTS_DIR", str(tmp_path))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def sample_notes():
    return [
        {"note": 60, "start_time": 0.0, "duration": 0.5, "velocity": 80},
        {"note": 64, "start_time": 0.5, "duration": 0.5, "velocity": 90},
    ]
