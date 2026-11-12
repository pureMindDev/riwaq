// Small display helpers for passage status. Status is always shown as words, not only colour.
export const EVIDENCE_LABEL = {
  none: '',
  self_declared: 'Self-declared',
  recitation_checked: 'Passed the Muallim',
  declared: 'Declared (not yet recited)',
}

export function PassageChips({ passage }) {
  const p = passage
  return (
    <div className="chips">
      {p.status === 'learning' && <span className="chip chip-learning">Learning</span>}
      {p.status === 'memorised' && <span className="chip chip-memorised">Memorised</span>}
      {p.status === 'needs_review' && <span className="chip chip-needs">Needs more practice</span>}
      {p.due?.kind === 'overdue' && <span className="chip chip-overdue">Overdue by {p.due.days} {p.due.days === 1 ? 'day' : 'days'}</span>}
      {p.due?.kind === 'due' && <span className="chip chip-due">Due today</span>}
      {p.status !== 'learning' && EVIDENCE_LABEL[p.evidence] && <span className="chip chip-stale">{EVIDENCE_LABEL[p.evidence]}</span>}
    </div>
  )
}
