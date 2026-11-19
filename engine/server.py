"""Riwaq letter-check engine: wraps the open-source Quran Muaalem model behind one small HTTP endpoint.

  POST /letter?letter=<one Arabic letter>     body = raw audio bytes (webm/wav/mp3/m4a...; ffmpeg decodes it)
  header X-Engine-Key: <ENGINE_API_KEY>        (required when ENGINE_API_KEY is set; always set it on a server)
  -> {"result": "match"|"fix"|"miss"|"none", "expected": "ب", "heard": "ت", "hints": [...], "experimental": true}

Audio is decoded and analysed in memory and never written to disk. See README.md for setup.
"""
import hmac
import os
import subprocess

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Request

import letters as L

MAX_BYTES = 2_000_000
MAX_SECONDS = 8.0
MIN_SECONDS = 0.15
MIN_RMS = 0.003  # below this the recording is silence


def decode_audio(data: bytes) -> np.ndarray:
    """Any audio container -> mono float32 at 16 kHz, using ffmpeg."""
    p = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
        input=data, capture_output=True, timeout=30,
    )
    if p.returncode != 0 or not p.stdout:
        raise ValueError("could not decode audio")
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def load_model():
    import torch
    from quran_muaalem.inference import Muaalem

    device = os.environ.get("ENGINE_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.bfloat16 if device.startswith("cuda") else torch.float32  # bfloat16 is the training dtype; float32 is the safe CPU choice
    return Muaalem(model_name_or_path=os.environ.get("MUAALEM_MODEL", "obadx/muaalem-model-v3_2"), device=device, dtype=dtype)


def create_app(model_factory=load_model) -> FastAPI:
    app = FastAPI(title="Riwaq letter engine")
    state = {"model": None}
    consonants = L.consonant_set()
    key = os.environ.get("ENGINE_API_KEY", "")
    block_on_hints = os.environ.get("SIFAT_HINTS_BLOCK", "true").lower() != "false"

    @app.on_event("startup")
    def _load():
        state["model"] = model_factory()

    @app.get("/health")
    def health():
        return {"ok": state["model"] is not None, "engine": "quran-muaalem"}

    @app.post("/letter")
    async def letter(request: Request, letter: str = Query(..., min_length=1, max_length=1)):
        if key and not hmac.compare_digest(request.headers.get("x-engine-key", ""), key):
            raise HTTPException(401, "bad key")
        if letter not in L.LETTER_CHARS:
            raise HTTPException(400, "unknown letter")
        data = await request.body()
        if not data or len(data) > MAX_BYTES:
            raise HTTPException(400, "send one short recording as the request body")
        if state["model"] is None:
            raise HTTPException(503, "model is still loading")
        try:
            wave = decode_audio(data)
        except Exception:
            raise HTTPException(400, "could not read the audio")
        seconds = len(wave) / 16000
        if seconds > MAX_SECONDS:
            raise HTTPException(400, f"recording is longer than {int(MAX_SECONDS)} seconds")
        ref = L.reference_for(letter)
        quiet = seconds < MIN_SECONDS or float(np.sqrt(np.mean(np.square(wave)))) < MIN_RMS
        if quiet:
            out = L.judge(ref, "", None, consonants, speech_ok=False)
        else:
            res = state["model"]([wave], [ref], 16000)[0]
            first = res.sifat[0] if res.sifat else None
            out = L.judge(ref, res.phonemes.text, first, consonants, block_on_hints=block_on_hints)
            if out["result"] in ("match", "fix") and len(res.phonemes.probs):
                out["confidence"] = round(float(res.phonemes.probs[0]), 3)
        return {**out, "experimental": True, "engine": "quran-muaalem"}

    return app


app = create_app() if os.environ.get("RIWAQ_ENGINE_NO_AUTOSTART") != "1" else None
