import test from 'node:test'
import assert from 'node:assert/strict'
// Same rule as showJoin in pages/Foundation.jsx (kept free of JSX so node:test can import it).
import { showJoin, formKeys } from './join.js'

test('joining side is shown with a tatweel, non-joining sides are untouched', () => {
  assert.equal(showJoin('ب‍'), 'بـ')
  assert.equal(showJoin('‍ب‍'), 'ـبـ')
  assert.equal(showJoin('‍ا'), 'ـا')
  assert.equal(showJoin('ا'), 'ا')
  assert.ok(!showJoin('‍ب‍').includes('‍'))
})

test('non-joining letters show two shapes, joining letters four', () => {
  assert.deepEqual(formKeys(false), ['isolated', 'final'])
  assert.deepEqual(formKeys(true), ['isolated', 'initial', 'medial', 'final'])
})
