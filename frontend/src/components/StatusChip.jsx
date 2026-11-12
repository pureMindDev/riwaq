import { dueState } from '../lib/scheduler.js'

// Status is always shown as words, not only colour.
export function PassageChip({ passage, today }) {
  if (passage.status === 'learning') return <span className="chip chip-learning">Learning</span>
  const due = passage.schedule ? dueState(passage.schedule, today) : null
  return (
    <>
      {passage.status === 'needs_review' && <span className="chip chip-needs">Needs more practice</span>}
      {passage.status === 'memorised' && <span className="chip chip-memorised">Memorised</span>}
      {due?.kind === 'overdue' && <span className="chip chip-overdue">Overdue by {due.days} {due.days === 1 ? 'day' : 'days'}</span>}
      {due?.kind === 'due' && <span className="chip chip-due">Due today</span>}
    </>
  )
}
