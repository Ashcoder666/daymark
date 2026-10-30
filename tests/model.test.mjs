import assert from 'node:assert/strict'
import test from 'node:test'
import { applyCloudTaskChanges, isPrefs, isSession, isTaskList } from '../src/model.ts'

const item = {
  id: 'one', title: 'Write proposal', project: 'Startup', date: '2026-10-30',
  time: '', duration: 45, completed: false, recurring: false,
  recurrence: '', notes: '', color: 'violet',
}

test('saved tasks reject malformed or duplicate records', () => {
  assert.equal(isTaskList([item]), true)
  assert.equal(isTaskList([item, item]), false)
  assert.equal(isTaskList([{ ...item, duration: null }]), false)
  assert.equal(isTaskList([{ ...item, date: '' }]), false)
  assert.equal(isTaskList([{ ...item, date: '2026-99-99' }]), false)
})

test('settings and focus sessions are checked before restoration', () => {
  assert.equal(isPrefs({ theme: 'dark', cutoff: '00:00', compact: false, reminders: true }), true)
  assert.equal(isPrefs({ theme: 'dark', cutoff: '25:00', compact: false, reminders: true }), false)
  assert.equal(isSession(null), true)
  assert.equal(isSession({ taskId: 'one', duration: 2700, remaining: 1200, running: true, endsAt: Date.now() + 1200000 }), true)
})

test('an initial empty cloud snapshot does not erase a new local task', () => {
  const local = [item]
  assert.equal(applyCloudTaskChanges(local, []), local)
})

test('cloud task changes merge edits and genuine deletions by id', () => {
  const second = { ...item, id: 'two', title: 'Plan tomorrow' }
  const edited = { ...item, title: 'Write final proposal' }
  assert.deepEqual(
    applyCloudTaskChanges([item, second], [
      { type: 'modified', task: edited },
      { type: 'removed', id: 'two' },
    ]),
    [edited],
  )
})
