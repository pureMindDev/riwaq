// The foundation reading curriculum: Arabic letters, articulation overview, vowels, joining and fluency.
// This is teaching material about the Arabic WRITING SYSTEM. It contains no Qur'anic text: the final
// read-along lesson takes its verses from the Qur'an provider.

// joins = connects to the letter AFTER it. sound = the consonant sound (for syllable drills).
export const LETTERS = [
  { id: 'alif', char: 'ا', name: 'Alif', sound: null, joins: false },
  { id: 'ba', char: 'ب', name: 'Bā’', sound: 'b', joins: true },
  { id: 'ta', char: 'ت', name: 'Tā’', sound: 't', joins: true },
  { id: 'tha', char: 'ث', name: 'Thā’', sound: 'th', joins: true },
  { id: 'jim', char: 'ج', name: 'Jīm', sound: 'j', joins: true },
  { id: 'hha', char: 'ح', name: 'Ḥā’', sound: 'ḥ', joins: true },
  { id: 'kha', char: 'خ', name: 'Khā’', sound: 'kh', joins: true },
  { id: 'dal', char: 'د', name: 'Dāl', sound: 'd', joins: false },
  { id: 'dhal', char: 'ذ', name: 'Dhāl', sound: 'dh', joins: false },
  { id: 'ra', char: 'ر', name: 'Rā’', sound: 'r', joins: false },
  { id: 'zay', char: 'ز', name: 'Zāy', sound: 'z', joins: false },
  { id: 'sin', char: 'س', name: 'Sīn', sound: 's', joins: true },
  { id: 'shin', char: 'ش', name: 'Shīn', sound: 'sh', joins: true },
  { id: 'sad', char: 'ص', name: 'Ṣād', sound: 'ṣ', joins: true },
  { id: 'dad', char: 'ض', name: 'Ḍād', sound: 'ḍ', joins: true },
  { id: 'tta', char: 'ط', name: 'Ṭā’', sound: 'ṭ', joins: true },
  { id: 'zha', char: 'ظ', name: 'Ẓā’', sound: 'ẓ', joins: true },
  { id: 'ayn', char: 'ع', name: 'ʿAyn', sound: 'ʿ', joins: true },
  { id: 'ghayn', char: 'غ', name: 'Ghayn', sound: 'gh', joins: true },
  { id: 'fa', char: 'ف', name: 'Fā’', sound: 'f', joins: true },
  { id: 'qaf', char: 'ق', name: 'Qāf', sound: 'q', joins: true },
  { id: 'kaf', char: 'ك', name: 'Kāf', sound: 'k', joins: true },
  { id: 'lam', char: 'ل', name: 'Lām', sound: 'l', joins: true },
  { id: 'mim', char: 'م', name: 'Mīm', sound: 'm', joins: true },
  { id: 'nun', char: 'ن', name: 'Nūn', sound: 'n', joins: true },
  { id: 'ha', char: 'ه', name: 'Hā’', sound: 'h', joins: true },
  { id: 'waw', char: 'و', name: 'Wāw', sound: 'w', joins: false },
  { id: 'ya', char: 'ي', name: 'Yā’', sound: 'y', joins: true },
]

export const SHORT_VOWELS = [
  { id: 'fatha', mark: '\u064E', name: 'Fatḥa', vowel: 'a' },
  { id: 'kasra', mark: '\u0650', name: 'Kasra', vowel: 'i' },
  { id: 'damma', mark: '\u064F', name: 'Ḍamma', vowel: 'u' },
]

export const OTHER_MARKS = [
  { id: 'sukun', mark: '\u0652', name: 'Sukūn', meaning: 'no vowel: the letter is read without a vowel sound' },
  { id: 'shadda', mark: '\u0651', name: 'Shadda', meaning: 'the letter is doubled (pronounced twice, joined)' },
  { id: 'fathatan', mark: '\u064B', name: 'Fatḥatān', meaning: 'adds an “-an” sound at the end of a word' },
  { id: 'kasratan', mark: '\u064D', name: 'Kasratān', meaning: 'adds an “-in” sound at the end of a word' },
  { id: 'dammatan', mark: '\u064C', name: 'Ḍammatān', meaning: 'adds an “-un” sound at the end of a word' },
]

// Long-vowel (madd) patterns: short vowel + its matching letter.
export const LONG_VOWELS = [
  { id: 'aa', pattern: (c) => `${c}\u064E\u0627`, vowel: 'ā' },
  { id: 'ii', pattern: (c) => `${c}\u0650\u064A`, vowel: 'ī' },
  { id: 'uu', pattern: (c) => `${c}\u064F\u0648`, vowel: 'ū' },
]

export const ARTICULATION_AREAS = [
  { name: 'Al-Jawf (the open space of the mouth and throat)', letters: 'ا و ي', note: 'the three long-vowel (madd) letters' },
  { name: 'Al-Ḥalq (the throat)', letters: 'ء ه ع ح غ خ', note: 'deepest: ء ه · middle: ع ح · nearest the mouth: غ خ' },
  { name: 'Al-Lisān (the tongue)', letters: 'ق ك ج ش ي ض ل ن ر ط د ت ص ز س ظ ذ ث', note: '18 letters, from different parts of the tongue' },
  { name: 'Ash-Shafatayn (the lips)', letters: 'ف ب م و', note: 'ب م و use both lips; ف uses the lower lip and upper teeth' },
  { name: 'Al-Khayshūm (the nasal passage)', letters: 'ن م', note: 'the nasal sound (ghunna) of ن and م' },
]

// Where each letter is made (makhraj), as a short plain-language summary of the standard Tajweed makharij.
// `area` must be one of the ARTICULATION_AREAS names above (tested). This is a textbook summary, NOT a substitute for
// learning the sound from a qualified teacher, and it is not Tajweed-certified by this project.
const JAWF = ARTICULATION_AREAS[0].name, HALQ = ARTICULATION_AREAS[1].name, LISAN = ARTICULATION_AREAS[2].name, LIPS = ARTICULATION_AREAS[3].name
export const MAKHRAJ = {
  alif: { area: JAWF, place: 'The open space of the mouth: the mouth stays open and the sound flows out as a long “ā”. (Hamza ء, often confused with alif, is made at the deepest part of the throat.)' },
  ba: { area: LIPS, place: 'The two lips meet and then release.' },
  ta: { area: LISAN, place: 'The tip of the tongue touches the base of the upper front teeth (the same place as د and ط).' },
  tha: { area: LISAN, place: 'The tip of the tongue touches the edges of the upper front teeth (the same place as ذ and ظ).' },
  jim: { area: LISAN, place: 'The middle of the tongue rises to the roof of the mouth (the same place as ش and the consonant ي).' },
  hha: { area: HALQ, place: 'The middle of the throat. A clear, light breathy sound: not the same as ه.' },
  kha: { area: HALQ, place: 'The top of the throat, nearest the mouth. A rough, scraping sound, said with a full (heavy) mouth.' },
  dal: { area: LISAN, place: 'The tip of the tongue touches the base of the upper front teeth (the same place as ت and ط).' },
  dhal: { area: LISAN, place: 'The tip of the tongue touches the edges of the upper front teeth (the same place as ث and ظ).' },
  ra: { area: LISAN, place: 'The tip of the tongue, a little further back than for ن, with a light tap.' },
  zay: { area: LISAN, place: 'The tip of the tongue near the lower front teeth, giving a whistling sound (the same place as س and ص).' },
  sin: { area: LISAN, place: 'The tip of the tongue near the lower front teeth, giving a whistling sound (the same place as ز and ص).' },
  shin: { area: LISAN, place: 'The middle of the tongue rises to the roof of the mouth (the same place as ج and the consonant ي).' },
  sad: { area: LISAN, place: 'The tip of the tongue near the lower front teeth, said with a full (heavy) mouth. It is the heavy partner of س.' },
  dad: { area: LISAN, place: 'The side (edge) of the tongue presses against the upper back teeth (molars). A heavy sound, different from د.' },
  tta: { area: LISAN, place: 'The tip of the tongue touches the base of the upper front teeth, said with a full (heavy) mouth. It is the heavy partner of ت.' },
  zha: { area: LISAN, place: 'The tip of the tongue touches the edges of the upper front teeth, said with a full (heavy) mouth. It is the heavy partner of ذ.' },
  ayn: { area: HALQ, place: 'The middle of the throat (with ح). A squeezed, voiced sound from the throat.' },
  ghayn: { area: HALQ, place: 'The top of the throat, nearest the mouth (with خ). A gargling sound, said with a full (heavy) mouth.' },
  fa: { area: LIPS, place: 'The inside of the lower lip touches the edges of the upper front teeth.' },
  qaf: { area: LISAN, place: 'The very back of the tongue rises to the soft palate. A deep, heavy sound, further back than ك.' },
  kaf: { area: LISAN, place: 'The back of the tongue, slightly in front of where ق is made, touches the roof of the mouth. A light sound.' },
  lam: { area: LISAN, place: 'The side of the tongue near its tip touches the gum above the upper front teeth.' },
  mim: { area: LIPS, place: 'The two lips close, and the nasal sound (ghunna) comes through the nose.' },
  nun: { area: LISAN, place: 'The tip of the tongue touches the gum above the upper front teeth, and the nasal sound (ghunna) comes through the nose.' },
  ha: { area: HALQ, place: 'The deepest part of the throat. A light breath, not a hard scrape.' },
  waw: { area: LIPS, place: 'The two lips round together without fully closing. As the long vowel “ū” it comes from the open space of the mouth (Al-Jawf).' },
  ya: { area: LISAN, place: 'The middle of the tongue rises towards the roof of the mouth. As the long vowel “ī” it comes from the open space of the mouth (Al-Jawf).' },
}

const slice = (a, b) => LETTERS.slice(a, b).map((l) => l.id)

// type: 'letters' (study + name quiz) | 'vowels' | 'marks' | 'madd' | 'joining' | 'info' | 'drill' | 'readalong'
export const LESSONS = [
  { id: 'letters-1', order: 1, type: 'letters', title: 'Letters 1: Alif to Khā’', letterIds: slice(0, 7), quiz: true },
  { id: 'letters-2', order: 2, type: 'letters', title: 'Letters 2: Dāl to Ṣād', letterIds: slice(7, 14), quiz: true },
  { id: 'letters-3', order: 3, type: 'letters', title: 'Letters 3: Ḍād to Qāf', letterIds: slice(14, 21), quiz: true },
  { id: 'letters-4', order: 4, type: 'letters', title: 'Letters 4: Kāf to Yā’', letterIds: slice(21, 28), quiz: true },
  { id: 'articulation', order: 5, type: 'info', title: 'Where letters are articulated (overview)', quiz: true },
  { id: 'vowels', order: 6, type: 'vowels', title: 'Short vowels: fatḥa, kasra, ḍamma', quiz: true },
  { id: 'marks', order: 7, type: 'marks', title: 'Sukūn, shadda and tanwīn', quiz: true },
  { id: 'madd', order: 8, type: 'madd', title: 'Long vowels', quiz: true },
  { id: 'joining', order: 9, type: 'joining', title: 'Joining letters', quiz: true },
  { id: 'fluency', order: 10, type: 'drill', title: 'Reading fluency drills', quiz: true },
  { id: 'readalong', order: 11, type: 'readalong', title: 'Read aloud to the Muallim', quiz: false, passage: { surah: 1, from: 1, to: 7 } },
]

export const QUIZ_PASS_RATIO = 0.8
