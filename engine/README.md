# Riwaq letter engine (AI teacher for letters)

A small Python service that listens to one recording of one Arabic letter and says whether it was that letter,
using the open-source **Quran Muaalem** model (`obadx/muaalem-model-v3_2`, Hafs). The Riwaq backend sends the
learner's recording here and the Foundation letter card turns green or red.

**Status: the model has NOT been run by the project author** (the build environment could not download it).
The logic around it is tested (`test_letters.py`, `test_server.py`, with a fake model). Whether the real model
tells Alif from Ta, ح from ه, etc. in real voices is unknown until you run `evaluate.py` (below).

The model authors say it is "intended for assistance only" and is not a replacement for a qualified teacher.
Quran Muaalem's licence (QML 1.0, Apache-2.0 based) requires: disclose AI use to users before first use (Riwaq
shows a notice), no advertising or ad tracking, comply with Islamic Sharia provisions, and keep a free path to
core features if you ever charge. Read the licence in the package before launching.

## Run it on your computer (first test)
```bash
# 1. ffmpeg:   sudo apt install ffmpeg      (macOS: brew install ffmpeg ; Windows: see "Windows notes" below)
# 2. Python 3.10+ virtual environment
cd engine
python -m venv .venv && source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\activate ; Git Bash: source .venv/Scripts/activate
pip install -r requirements.txt                          # large: installs PyTorch (a few GB)
# 3. choose a secret and start (first start downloads the model from Hugging Face, about 2.5 GB)
export ENGINE_API_KEY="choose-a-long-random-secret"      # Windows PowerShell: $env:ENGINE_API_KEY="..."
uvicorn server:app --port 8000
# 4. check it is alive:  curl http://localhost:8000/health   ->  {"ok":true,...}
```
### Windows notes (tested on Windows 11 / Git Bash, Python 3.12)
- Install Python and ffmpeg with `winget install Python.Python.3.12` and `winget install Gyan.FFmpeg`. Git Bash does not see a new PATH until you open a NEW window, and `python` may not be found even then; the full path (`~/AppData/Local/Programs/Python/Python312/python.exe`) works.
- If ffmpeg is still "not found" in Git Bash, add it for that window: `export PATH="$PATH:$HOME/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-<version>-full_build/bin"`. Without ffmpeg every recording is rejected with "That recording could not be used".
- **Every new terminal window must activate the virtual environment first** (or `uvicorn` is "command not found").
- `requirements.txt` pins `transformers<5`: quran-muaalem 0.3.0 fails to import on transformers 5.x (`cannot import name '_HIDDEN_STATES_START_POSITION'`).
- On a slow or unstable connection the 2.4 GB model download can stall or drop. Use the plain downloader and a longer timeout, then simply run the same command again; it resumes: `export HF_HUB_DISABLE_XET=1 HF_HUB_DOWNLOAD_TIMEOUT=120`.

CPU works (each check takes a few seconds). A GPU with ~1.5 GB of memory is much faster (`ENGINE_DEVICE=cuda`).

## Connect it to Riwaq (backend/.env)
```
LETTER_ENGINE_URL=http://localhost:8000
LETTER_ENGINE_KEY=<the same ENGINE_API_KEY>
LETTER_PROOF_SECRET=<any long random text>   # signs the receipt for spoken quiz questions (see docs/LETTER_AUDIO.md)
```
Restart the backend. `GET /api/status` then shows `letterCheck.available: true`, and letter cards use the AI check
instead of the browser's speech recognition.

## Measure it (do this before trusting it)
Record yourself (see the layout at the top of `evaluate.py`): each letter said correctly a few times, and each
letter deliberately said wrongly (say another letter while the app expects this one). Then:
```bash
python evaluate.py recordings --url http://localhost:8000 --key "$ENGINE_API_KEY"
```
Send me the printed table and I will tune the rules (for example, which articulation notes block a green).

## Tests (no model needed)
```bash
pip install quran-transcript fastapi httpx numpy
python test_letters.py
RIWAQ_ENGINE_NO_AUTOSTART=1 ENGINE_API_KEY=secret python test_server.py
```
Settings: `ENGINE_API_KEY`, `ENGINE_DEVICE` (cpu/cuda), `MUAALEM_MODEL`, `SIFAT_HINTS_BLOCK=false` (articulation notes
become advice only instead of keeping the card red).

## Deploying for real users
Run it on a server you control (a small GPU machine is best), behind HTTPS or on a private network reachable only by
the Riwaq backend; keep `ENGINE_API_KEY` secret. Do not expose it to browsers directly.


## Passage check (hifz and muraja'ah)

`POST /recite?surah=1&from=1&to=7` with the recording as the body (and the `X-Engine-Key` header) returns one record per word (ok, wrong, omitted, not_reached) plus Tajweed notes. Same engine, same `LETTER_ENGINE_URL`: the backend uses it automatically for the Muallim. Tests without the model: `python test_recite.py` and `RIWAQ_ENGINE_NO_AUTOSTART=1 ENGINE_API_KEY=secret python test_server.py`. See `docs/RECITATION.md` for the policy and the accuracy warning.
