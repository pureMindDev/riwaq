"""Measure how well the engine marks YOUR recordings. Run this before trusting the red/green feedback.

Folder layout (file names are free; formats: wav, webm, m4a, mp3, ogg):

  recordings/
    correct/<letter>/*.m4a   you saying that letter correctly (the engine should answer match)
    wrong/<letter>/*.m4a     you deliberately saying a DIFFERENT letter or a wrong sound, while the app expects <letter>
                             (the engine should NOT answer match)
  <letter> is the Arabic letter itself, e.g.  correct/ب/take1.m4a   wrong/ب/said-ta.m4a

  python evaluate.py recordings --url http://localhost:8000 --key YOUR_ENGINE_KEY

Prints, per letter, how many correct recordings were accepted and how many wrong ones were rejected, and the
overall numbers. Better to have recordings from several people (men, women, children) and a teacher's
judgement of which recordings are really correct. Your own voice alone is a first check only.
"""
import argparse, json, sys, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

EXT = {".wav", ".webm", ".m4a", ".mp3", ".ogg", ".opus", ".aac"}
TYPE = {".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".aac": "audio/aac"}


def ask(url, key, letter, path):
    req = urllib.request.Request(f"{url.rstrip('/')}/letter?letter={urllib.parse.quote(letter)}", data=path.read_bytes(), method="POST",
                                 headers={"Content-Type": TYPE[path.suffix.lower()], **({"X-Engine-Key": key} if key else {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder"); ap.add_argument("--url", default="http://localhost:8000"); ap.add_argument("--key", default="")
    a = ap.parse_args()
    root = Path(a.folder)
    stats = defaultdict(lambda: {"ok_right": 0, "n_right": 0, "ok_wrong": 0, "n_wrong": 0, "confused": defaultdict(int)})
    for kind in ("correct", "wrong"):
        for f in sorted((root / kind).glob("*/*")):
            if f.suffix.lower() not in EXT:
                continue
            letter = f.parent.name
            res = ask(a.url, a.key, letter, f)
            s = stats[letter]
            accepted = res["result"] == "match"
            if kind == "correct":
                s["n_right"] += 1; s["ok_right"] += accepted
                if not accepted: s["confused"][f"{res['result']}:{res.get('heard','')}"] += 1
            else:
                s["n_wrong"] += 1; s["ok_wrong"] += (not accepted)
                if accepted: s["confused"]["wrong-accepted"] += 1
    if not stats:
        sys.exit("no recordings found; see the layout at the top of this file")
    tr = ok_r = tw = ok_w = 0
    print(f"{'letter':<8}{'correct accepted':>18}{'wrong rejected':>18}   notes")
    for letter in sorted(stats):
        s = stats[letter]; tr += s["n_right"]; ok_r += s["ok_right"]; tw += s["n_wrong"]; ok_w += s["ok_wrong"]
        notes = ", ".join(f"{k} x{v}" for k, v in s["confused"].items())
        print(f"{letter:<8}{s['ok_right']:>8}/{s['n_right']:<9}{s['ok_wrong']:>8}/{s['n_wrong']:<9}   {notes}")
    print(f"\nOVERALL correct accepted: {ok_r}/{tr}  ({100*ok_r/max(tr,1):.0f}%)   wrong rejected: {ok_w}/{tw}  ({100*ok_w/max(tw,1):.0f}%)")
    print("A usable checker needs BOTH numbers high (aim for 90%+ on many speakers). Low 'wrong rejected' means it lets mistakes through.")


if __name__ == "__main__":
    main()
