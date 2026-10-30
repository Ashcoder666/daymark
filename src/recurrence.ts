import type { Task } from './model'

function parseDate(key: string) {
  const date = new Date(`${key}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function keyFor(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function matchesSchedule(template: Task, candidate: Date, firstDate: Date) {
  switch (template.recurrence) {
    case 'Every day': return true
    case 'Every weekday': return candidate.getDay() >= 1 && candidate.getDay() <= 5
    case 'Every week': return candidate.getDay() === firstDate.getDay()
    case 'Every month': return candidate.getDate() === firstDate.getDate()
    default: return false
  }
}

export function generateOccurrences(tasks: Task[], throughKey: string): Task[] {
  const through = parseDate(throughKey)
  if (!through) return tasks
  const existing = new Set(tasks.filter(task => task.templateId).map(task => `${task.templateId}:${task.occurrenceDate ?? task.date}`))
  const created: Task[] = []

  for (const template of tasks.filter(task => task.recurring && !task.templateId && !task.paused)) {
    const first = parseDate(template.date)
    if (!first || first >= through) continue
    const cursor = new Date(first)
    cursor.setDate(cursor.getDate() + 1)
    const resumeFrom = template.resumeFrom ? parseDate(template.resumeFrom) : null
    if (resumeFrom && cursor < resumeFrom) cursor.setTime(resumeFrom.getTime())
    while (cursor <= through) {
      const date = keyFor(cursor)
      const occurrenceKey = `${template.id}:${date}`
      if (matchesSchedule(template, cursor, first) && !existing.has(occurrenceKey)) {
        created.push({ ...template, id: crypto.randomUUID(), date, occurrenceDate: date, completed: false, recurring: false, recurrence: '', templateId: template.id })
        existing.add(occurrenceKey)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return created.length ? [...tasks, ...created] : tasks
}
