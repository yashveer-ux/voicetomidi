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
