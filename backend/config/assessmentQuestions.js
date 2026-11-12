// The initial placement questionnaire. Answers are self-reported; the result is a SUGGESTION
// that the learner can change. It is not a certified assessment.
export const ASSESSMENT_QUESTIONS = [
  { id: 'letters', section: 'reading', text: 'Can you recognise and read the letters of the Arabic alphabet?',
    options: [{ value: 0, label: 'No, I cannot yet' }, { value: 1, label: 'Some of them' }, { value: 2, label: 'Yes, all of them' }] },
  { id: 'vowels', section: 'reading', text: 'Can you read Arabic words with the short vowel marks (fatha, kasra, damma)?',
    options: [{ value: 0, label: 'No' }, { value: 1, label: 'Slowly, with mistakes' }, { value: 2, label: 'Yes, fairly smoothly' }] },
  { id: 'joining', section: 'reading', text: 'Do you recognise how letters change shape when they join in a word?',
    options: [{ value: 0, label: 'No' }, { value: 1, label: 'Somewhat' }, { value: 2, label: 'Yes' }] },
  { id: 'quranReading', section: 'reading', text: 'Can you read the Qur’an from the mushaf without help?',
    options: [{ value: 0, label: 'No' }, { value: 1, label: 'With help or slowly' }, { value: 2, label: 'Yes, fluently' }] },
  { id: 'memorised', section: 'memorisation', text: 'How much of the Qur’an have you memorised?',
    options: [{ value: 'none', label: 'Nothing yet' }, { value: 'some', label: 'Some short Surahs' },
      { value: 'juz', label: 'One or more Ajza’' }, { value: 'hafiz', label: 'All of it (Hafiz / Hafidah)' }] },
  { id: 'minutes', section: 'memorisation', text: 'How much time can you give each day to new memorisation?',
    options: [{ value: 15, label: 'About 15 minutes' }, { value: 30, label: 'About 30 minutes' }, { value: 60, label: '60 minutes or more' }] },
]
