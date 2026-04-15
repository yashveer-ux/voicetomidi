import pytest
from unittest.mock import patch

FAKE_WAV = b"RIFF" + b"\x00" * 40


async def test_synthesize_valid_returns_wav(async_client, sample_notes):
    with patch("routers.synthesize.synthesize", return_value=FAKE_WAV):
        response = await async_client.post(
            "/synthesize",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"


async def test_synthesize_invalid_instrument_returns_400(async_client, sample_notes):
    response = await async_client.post(
        "/synthesize",
        json={"notes": sample_notes, "instrument": "trumpet", "bpm": 120.0},
    )
    assert response.status_code == 400
    assert "invalid instrument" in response.json()["detail"].lower()
