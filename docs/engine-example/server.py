"""UNTESTED EXAMPLE of a recognition engine for Riwaq.

Written without access to the model (the build environment could not reach Hugging Face), so it has
only been syntax-checked. Treat it as a starting point and test it yourself.

  pip install fastapi uvicorn transformers torch    (ffmpeg must be installed)
  uvicorn server:app --port 8000
  # then set RECITATION_ENGINE_URL=http://localhost:8000/transcribe in backend/.env

Check the model's licence before using it. Audio is processed in memory and not saved.
"""
from fastapi import FastAPI, Request
from transformers import pipeline

MODEL = "tarteel-ai/whisper-base-ar-quran"  # example only: verify licence, accuracy and size yourself
asr = pipeline("automatic-speech-recognition", model=MODEL)
app = FastAPI()


@app.post("/transcribe")
async def transcribe(request: Request):
    audio = await request.body()           # raw audio bytes (webm/wav/mp3...), decoded via ffmpeg
    text = asr(audio)["text"]
    # This model gives no per-word confidence, so none is returned.
    return {"words": [{"text": w} for w in text.split()]}
