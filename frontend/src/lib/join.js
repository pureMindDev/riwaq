// The backend marks "joins here" with a zero-width joiner, which draws no line. Textbooks show the joining side with a
// stretch stroke (tatweel), so a learner can see how the letter connects. Display only; the saved data is unchanged.
export const showJoin = (form) => String(form).replaceAll('‍', 'ـ')

// Letters that never connect to the next one have only two shapes (alone, and joined to the previous letter).
export const formKeys = (joins) => (joins ? ['isolated', 'initial', 'medial', 'final'] : ['isolated', 'final'])
