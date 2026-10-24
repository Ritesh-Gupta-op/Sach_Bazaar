from __future__ import annotations

import hashlib

from fastapi import FastAPI, UploadFile
from pydantic import BaseModel

app = FastAPI(title="SachBazaar AI Service", version="0.2.0")


class AdvisoryResult(BaseModel):
    score: float
    explanation: str
    modelVersion: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sachbazaar-ai"}


@app.post("/grade", response_model=AdvisoryResult)
async def grade(photo: UploadFile) -> AdvisoryResult:
    """Deterministic placeholder grading.

    The score is sha256-seeded from the raw photo bytes so the same photo
    always grades identically and different photos spread across the range —
    enough to drive the advisory attestation demo until the real tomato
    grading model lands (Phase 3).
    """
    data = await photo.read()
    digest = hashlib.sha256(data).digest()
    score = int.from_bytes(digest[:4], "big") / 2**32
    band = (
        "excellent"
        if score >= 0.75
        else "good"
        if score >= 0.5
        else "fair"
        if score >= 0.25
        else "poor"
    )
    return AdvisoryResult(
        score=round(score, 3),
        explanation=f"sha256-seeded quality score ({len(data)}-byte sample) places this batch in the {band} band.",
        modelVersion="baseline-mock-0.2",
    )


@app.post("/weight-estimate", response_model=AdvisoryResult)
async def weight_estimate(photo: UploadFile) -> AdvisoryResult:
    del photo
    return AdvisoryResult(score=0.0, explanation="No trained weight model is configured yet.", modelVersion="baseline-mock-0.1")


@app.post("/price-anomaly", response_model=AdvisoryResult)
async def price_anomaly() -> AdvisoryResult:
    return AdvisoryResult(score=0.0, explanation="Synthetic baseline is not anomalous.", modelVersion="baseline-mock-0.1")


@app.post("/duplicate", response_model=AdvisoryResult)
async def duplicate(photo: UploadFile) -> AdvisoryResult:
    del photo
    return AdvisoryResult(score=0.0, explanation="Duplicate search is not configured yet.", modelVersion="baseline-mock-0.1")
