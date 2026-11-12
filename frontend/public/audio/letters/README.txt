Letter recordings go here, then are listed in manifest.json:
  { "alif": "alif.mp3", "ba": "ba.mp3" }
- Use recordings of each letter's NAME by a qualified Qur'an teacher/reader. Do not use synthesised speech.
- Letter ids are the "id" values in backend/config/foundationCurriculum.js (28 of them).
- Use MP3 or M4A (AAC): they play on every phone and desktop browser (OGG does not play on iPhones).
- A letter with no entry in manifest.json shows no play button. If a listed file is missing or cannot be played,
  the button appears greyed out with the message "Recording ... is not available".
