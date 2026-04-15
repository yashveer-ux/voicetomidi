import pytest


async def test_save_project_returns_project_id(async_client):
    payload = {"name": "My Song", "bpm": 140.0, "instrument": "guitar", "notes": []}
    response = await async_client.post("/project/save", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "project_id" in body
    assert len(body["project_id"]) == 8


async def test_load_project_returns_saved_data(async_client):
    payload = {"name": "My Song", "bpm": 140.0, "instrument": "guitar", "notes": []}
    save_resp = await async_client.post("/project/save", json=payload)
    project_id = save_resp.json()["project_id"]

    load_resp = await async_client.get(f"/project/{project_id}")
    assert load_resp.status_code == 200
    body = load_resp.json()
    assert body["name"] == "My Song"
    assert body["bpm"] == 140.0
    assert body["instrument"] == "guitar"


async def test_list_projects_includes_saved_project(async_client):
    payload = {"name": "Listed Song", "bpm": 120.0, "instrument": "piano", "notes": []}
    save_resp = await async_client.post("/project/save", json=payload)
    project_id = save_resp.json()["project_id"]

    list_resp = await async_client.get("/project/list")
    assert list_resp.status_code == 200
    ids = [p["project_id"] for p in list_resp.json()["projects"]]
    assert project_id in ids


async def test_load_nonexistent_project_returns_404(async_client):
    response = await async_client.get("/project/doesnotexist")
    assert response.status_code == 404
