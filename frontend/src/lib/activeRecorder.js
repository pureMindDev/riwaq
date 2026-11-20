// Only one recording may run at a time across the whole page (letter cards and quiz questions share the microphone).
let current = null

export const activeRecorder = {
  stopOthers(self) { if (current && current !== self) current() },
  set(self) { current = self },
  release(self) { if (current === self) current = null },
  stopAny() { if (current) current() },
}
