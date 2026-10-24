"""Determinism and shape checks for the advisory grading mock."""

from __future__ import annotations

import hashlib

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def expected_score(data: bytes) -> float:
    return round(int.from_bytes(hashlib.sha256(data).digest()[:4], "big") / 2**32, 3)


def grade(payload: bytes) -> dict:
    response = client.post("/grade", files={"photo": ("sample.jpg", payload, "image/jpeg")})
    assert response.status_code == 200
    return response.json()


def test_health() -> None:
    body = client.get("/health").json()
    assert body == {"status": "ok", "service": "sachbazaar-ai"}


def test_same_photo_always_grades_identically() -> None:
    first = grade(b"same-photo-bytes")
    second = grade(b"same-photo-bytes")
    assert first["score"] == second["score"]
    assert first["score"] == expected_score(b"same-photo-bytes")
    assert first["modelVersion"]


def test_different_photos_grade_differently() -> None:
    assert grade(b"photo-one")["score"] != grade(b"photo-two")["score"]


def test_band_matches_the_score() -> None:
    body = grade(b"band-sample")
    score = body["score"]
    band = "excellent" if score >= 0.75 else "good" if score >= 0.5 else "fair" if score >= 0.25 else "poor"
    assert band in body["explanation"]
