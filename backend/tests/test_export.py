import pytest
from unittest.mock import patch

FAKE_WAV = b"RIFF" + b"\x00" * 40
FAKE_MP3 = b"ID3" + b"\x00" * 40
FAKE_MIDI = b"MThd" + b"\x00" * 14


async def test_export_wav(async_client, sample_notes):
    with patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_wav", return_value=FAKE_WAV):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "wav"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert "hummed_export.wav" in response.headers["content-disposition"]


async def test_export_mp3(async_client, sample_notes):
    with patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_mp3", return_value=FAKE_MP3):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "mp3"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert "hummed_export.mp3" in response.headers["content-disposition"]


async def test_export_midi(async_client, sample_notes):
    with patch("routers.export.export_midi", return_value=FAKE_MIDI):
        response = await async_client.post(
            "/export",
            json={"notes": sample_notes, "instrument": "piano", "bpm": 120.0, "format": "midi"},
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/midi"
    assert "hummed_export.mid" in response.headers["content-disposition"]
