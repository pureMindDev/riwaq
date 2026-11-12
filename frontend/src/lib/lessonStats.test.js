import test from 'node:test'
import assert from 'node:assert/strict'
import { attemptCount, bestScore, scoreLabel, attemptsLabel } from './lessonStats.js'

test('attempts: real saved count, otherwise 0; never undefined, null or NaN', () => {
  assert.equal(attemptCount({ attempts: 3 }), 3)
  assert.equal(attemptCount({ attempts: 0 }), 0)
  for (const bad of [undefined, null, {}, { attempts: undefined }, { attempts: null }, { attempts: NaN }, { attempts: '2' }, { attempts: -1 }, { attempts: 1.5 }]) assert.equal(attemptCount(bad), 0)
  assert.equal(attemptsLabel({}), 'Attempts: 0')
  assert.equal(attemptsLabel({ attempts: 4 }), 'Attempts: 4')
})

test('score: from the saved best result only; unusable data means "not tried"', () => {
  assert.deepEqual(bestScore({ best: { score: 5, total: 7 } }), { score: 5, total: 7, percent: 71 })
  assert.equal(scoreLabel({ best: { score: 7, total: 7 } }), 'Best score: 100% (7/7)')
  for (const bad of [undefined, {}, { best: null }, { best: { score: 1, total: 0 } }, { best: { score: NaN, total: 7 } }]) {
    assert.equal(bestScore(bad), null)
    assert.equal(scoreLabel(bad), 'Best score: not tried yet')
  }
  assert.ok(!/undefined|null|NaN/.test(scoreLabel({ best: { score: 3, total: 7 } }) + attemptsLabel({ attempts: 2 })))
})
