"""HTTP-layer tests with a FAKE model (the real model is not downloaded). Needs: pip install fastapi httpx numpy; ffmpeg.
Run: RIWAQ_ENGINE_NO_AUTOSTART=1 ENGINE_API_KEY=secret python test_server.py"""
import os, subprocess
os.environ["RIWAQ_ENGINE_NO_AUTOSTART"] = "1"; os.environ["ENGINE_API_KEY"] = "secret"
from types import SimpleNamespace as NS
from fastapi.testclient import TestClient
import server

def wav(freq=440, seconds=1.0):
    return subprocess.run(["ffmpeg","-loglevel","error","-f","lavfi","-i",f"sine=frequency={freq}:duration={seconds}","-f","wav","pipe:1"],capture_output=True).stdout
def silence(seconds=1.0):
    return subprocess.run(["ffmpeg","-loglevel","error","-f","lavfi","-i","anullsrc=r=16000:cl=mono","-t",str(seconds),"-f","wav","pipe:1"],capture_output=True).stdout

say = {"text": "ب"}
class Fake:
    def __call__(self, waves, refs, sr):
        assert sr == 16000 and len(waves) == 1 and waves[0].dtype.name == "float32"
        return [NS(phonemes=NS(text=say["text"], probs=[0.93]), sifat=[NS(hams_or_jahr=None, shidda_or_rakhawa=None, tafkheem_or_taqeeq=None, itbaq=None, safeer=None, qalqla=None, ghonna=None)])]

client_ctx = TestClient(server.create_app(lambda: Fake()))
H = {"x-engine-key": "secret"}
with client_ctx as c:
    assert c.get("/health").json()["ok"] is True
    r = c.post("/letter?letter=ب", content=wav(), headers=H); assert r.status_code == 200, r.text
    j = r.json(); assert (j["result"], j["expected"], j["confidence"], j["experimental"]) == ("match", "ب", 0.93, True), j
    say["text"] = "ت"; j = c.post("/letter?letter=ب", content=wav(), headers=H).json(); assert (j["result"], j["heard"]) == ("miss", "ت"), j
    say["text"] = ""; assert c.post("/letter?letter=ب", content=wav(), headers=H).json()["result"] == "none"
    say["text"] = "ب"; assert c.post("/letter?letter=ب", content=silence(), headers=H).json()["result"] == "none"  # silence never reaches the model
    assert c.post("/letter?letter=ب", content=wav()).status_code == 401  # no key
    assert c.post("/letter?letter=ب", content=wav(), headers={"x-engine-key": "nope"}).status_code == 401
    assert c.post("/letter?letter=x", content=wav(), headers=H).status_code == 400  # unknown letter
    assert c.post("/letter?letter=ب", content=b"", headers=H).status_code == 400
    assert c.post("/letter?letter=ب", content=b"not audio at all" * 50, headers=H).status_code == 400
    assert c.post("/letter?letter=ب", content=wav(seconds=9), headers=H).status_code == 400  # too long
    assert c.post("/letter?letter=ب", content=b"x" * 2_000_001, headers=H).status_code == 400
print("ok: engine HTTP layer (fake model)")
