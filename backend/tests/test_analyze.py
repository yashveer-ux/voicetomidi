import pytest
from unittest.mock import patch


async def test_analyze_valid_audio_returns_notes(async_client, sample_notes):
    # > 1000 bytes satisfies the length check; content-type passes the audio check
    fake_audio = b"\x00" * 1200
    with patch("routers.analyze.analyze_audio", return_value=sample_notes):
        response = await async_client.post(
            "/analyze",
            files={"file": ("recording.wav", fake_audio, "audio/wav")},
            data={"bpm": "120.0"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert len(body["notes"]) == 2


async def test_analyze_non_audio_content_type_returns_400(async_client):
    fake_data = b"\x00" * 1200
    response = await async_client.post(
        "/analyze",
        files={"file": ("document.pdf", fake_data, "application/pdf")},
        data={"bpm": "120.0"},
    )
    assert response.status_code == 400
    assert "audio" in response.json()["detail"].lower()


async def test_analyze_short_audio_returns_400(async_client):
    # < 1000 bytes triggers the "too short" check
    short_audio = b"\x00" * 500
    response = await async_client.post(
        "/analyze",
        files={"file": ("short.wav", short_audio, "audio/wav")},
        data={"bpm": "120.0"},
    )
    assert response.status_code == 400
    assert "short" in response.json()["detail"].lower()


# ── Unit tests for pure helper functions ──────────────────────────────────────
from services.audio_analyzer import _remove_outliers, _merge_close_notes


def test_remove_outliers_fewer_than_4_notes_unchanged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
    ]
    assert _remove_outliers(notes) == notes


def test_remove_outliers_removes_pitch_outlier():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
        {"note": 64, "start_time": 0.6, "duration": 0.3, "velocity": 80},
        {"note": 100, "start_time": 0.9, "duration": 0.3, "velocity": 80},  # outlier
    ]
    result = _remove_outliers(notes)
    assert all(n["note"] != 100 for n in result)


def test_remove_outliers_removes_notes_shorter_than_80ms():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.3, "velocity": 80},
        {"note": 62, "start_time": 0.3, "duration": 0.3, "velocity": 80},
        {"note": 64, "start_time": 0.6, "duration": 0.3, "velocity": 80},
        {"note": 63, "start_time": 0.9, "duration": 0.05, "velocity": 80},  # < 80ms
    ]
    result = _remove_outliers(notes)
    assert all(n["duration"] >= 0.08 for n in result)


def test_merge_close_notes_same_pitch_small_gap_merges():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.4, "velocity": 80},
        # gap = 0.45 - 0.4 = 0.05, which is < 0.15 threshold
        {"note": 60, "start_time": 0.45, "duration": 0.4, "velocity": 90},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 1
    assert result[0]["duration"] == pytest.approx(0.85, abs=0.01)
    assert result[0]["velocity"] == 90  # max of the two


def test_merge_close_notes_different_pitch_not_merged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.4, "velocity": 80},
        {"note": 62, "start_time": 0.45, "duration": 0.4, "velocity": 80},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 2


def test_merge_close_notes_same_pitch_large_gap_not_merged():
    notes = [
        {"note": 60, "start_time": 0.0, "duration": 0.1, "velocity": 80},
        # gap = 0.5 - 0.1 = 0.4, which is > 0.15 threshold
        {"note": 60, "start_time": 0.5, "duration": 0.4, "velocity": 80},
    ]
    result = _merge_close_notes(notes)
    assert len(result) == 2


def test_merge_close_notes_empty_list():
    assert _merge_close_notes([]) == []
