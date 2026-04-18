import pytest
from unittest.mock import patch, MagicMock


async def test_create_checkout_session(async_client):
    fake_session = MagicMock()
    fake_session.id = "cs_test_abc123"
    fake_session.url = "https://checkout.stripe.com/pay/cs_test_abc123"

    with patch("routers.checkout.stripe") as mock_stripe:
        mock_stripe.checkout.Session.create.return_value = fake_session
        response = await async_client.post(
            "/checkout", json={"format": "wav"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "cs_test_abc123"
    assert data["checkout_url"] == "https://checkout.stripe.com/pay/cs_test_abc123"


async def test_create_checkout_invalid_format(async_client):
    response = await async_client.post(
        "/checkout", json={"format": "ogg"}
    )
    assert response.status_code == 422


import routers.export as export_router_module


async def test_verified_export_wav(async_client, sample_notes):
    export_router_module._used_sessions.clear()

    fake_session = MagicMock()
    fake_session.payment_status = "paid"

    FAKE_WAV = b"RIFF" + b"\x00" * 40

    with patch("routers.export.stripe") as mock_stripe, \
         patch("routers.export.synthesize", return_value=FAKE_WAV), \
         patch("routers.export.export_wav", return_value=FAKE_WAV):
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_wav",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"


async def test_verified_export_duplicate_session(async_client, sample_notes):
    export_router_module._used_sessions.clear()
    export_router_module._used_sessions.add("cs_test_dup")

    fake_session = MagicMock()
    fake_session.payment_status = "paid"

    with patch("routers.export.stripe") as mock_stripe:
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_dup",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 409


async def test_verified_export_unpaid(async_client, sample_notes):
    export_router_module._used_sessions.clear()

    fake_session = MagicMock()
    fake_session.payment_status = "unpaid"

    with patch("routers.export.stripe") as mock_stripe:
        mock_stripe.checkout.Session.retrieve.return_value = fake_session
        response = await async_client.post(
            "/export/verified",
            json={
                "session_id": "cs_test_unpaid",
                "format": "wav",
                "notes": sample_notes,
                "bpm": 120.0,
                "instrument": "piano",
            },
        )

    assert response.status_code == 402
