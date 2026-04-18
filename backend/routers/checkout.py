import os
import stripe
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")

router = APIRouter()


class CheckoutRequest(BaseModel):
    format: Literal["wav", "mp3", "midi"]


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest):
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": 100,  # €1.00 in cents
                "product_data": {
                    "name": f"VOICEtoMIDI Export – {req.format.upper()}",
                },
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{FRONTEND_URL}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}?export_cancelled=1",
    )

    return {"session_id": session.id, "checkout_url": session.url}
