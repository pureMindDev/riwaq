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
