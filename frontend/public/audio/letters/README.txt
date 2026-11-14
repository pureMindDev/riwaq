Letter recordings and their credits.
- manifest.json maps each of the 28 letter ids (backend/config/foundationCurriculum.js) to ONE recording and records reader, licence and source.
- CREDITS.txt is the attribution list required by the licences (CC0, CC BY 4.0, CC BY-SA 3.0). Keep it with the files; the app links to it.
- The current clips are the spoken NAME of each letter by native Arabic speakers (Lingua Libre / Wikimedia Commons). They are NOT Tajweed-verified.
- To replace a clip with a better one (e.g. a qualified Qur'an teacher's recording): save MP3 or M4A here, update that letter's entry (file, reader, licence, source, verifiedBy), update CREDITS.txt, then run `npm run check:audio` (in frontend/).
- Never use synthesised speech and never reuse one recording for two letters (the checker rejects duplicates).
