from __future__ import annotations

from fastapi import FastAPI, UploadFile
from pydantic import BaseModel

app = FastAPI(title="SachBazaar AI Service", version="0.1.0")


class AdvisoryResult(BaseModel):
    score: float
    explanation: str
    modelVersion: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sachbazaar-ai"}


@app.post("/grade", response_model=AdvisoryResult)
async def grade(photo: UploadFile) -> AdvisoryResult:
    del photo
    return AdvisoryResult(score=0.0, explanation="Baseline model is advisory and not configured yet.", modelVersion="baseline-mock-0.1")


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
