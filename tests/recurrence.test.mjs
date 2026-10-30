import assert from 'node:assert/strict'
import test from 'node:test'
import { generateOccurrences } from '../src/recurrence.ts'

const task = (overrides = {}) => ({
  id: 'template-1', title: 'Study', project: 'Learning', date: '2026-10-26',
  time: '09:00', duration: 45, completed: true, recurring: true,
  recurrence: 'Every weekday', notes: '', color: 'violet', ...overrides,
})

test('weekday recurrence preserves independent daily history and avoids duplicates', () => {
  const original = task()
  const generated = generateOccurrences([original], '2026-10-30')
  assert.deepEqual(generated.map(item => item.date), [
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
  ])
  assert.equal(generated[0].completed, true)
  assert.ok(generated.slice(1).every(item => !item.completed && item.templateId === original.id))
  assert.equal(generateOccurrences(generated, '2026-10-30').length, generated.length)
})

test('weekly recurrence follows the original weekday', () => {
  const generated = generateOccurrences([task({ recurrence: 'Every week' })], '2026-11-10')
  assert.deepEqual(generated.map(item => item.date), ['2026-10-26', '2026-11-02', '2026-11-09'])
})

test('monthly recurrence skips months without the original day', () => {
  const generated = generateOccurrences([task({ date: '2026-01-31', recurrence: 'Every month' })], '2026-03-31')
  assert.deepEqual(generated.map(item => item.date), ['2026-01-31', '2026-03-31'])
})

test('future templates do not create early tasks', () => {
  const original = task({ date: '2026-12-01', recurrence: 'Every day' })
  assert.deepEqual(generateOccurrences([original], '2026-10-30'), [original])
})

test('paused routines skip occurrences and resume without backfilling the pause', () => {
  const paused = task({ paused: true })
  assert.equal(generateOccurrences([paused], '2026-11-02').length, 1)
  const resumed = { ...paused, paused: false, resumeFrom: '2026-10-30' }
  const generated = generateOccurrences([resumed], '2026-11-02')
  assert.deepEqual(generated.map(item => item.date), ['2026-10-26', '2026-10-30', '2026-11-02'])
})

test('moving a generated occurrence does not regenerate its original date', () => {
  const generated = generateOccurrences([task()], '2026-10-27')
  const moved = generated.map(item => item.templateId ? { ...item, date: '2026-10-29' } : item)
  assert.equal(generateOccurrences(moved, '2026-10-27').length, 2)
})
