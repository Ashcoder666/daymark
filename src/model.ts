export type Task = {
  id: string
  title: string
  project: string
  date: string
  time: string
  duration: number
  completed: boolean
  recurring: boolean
  recurrence: string
  notes: string
  color: string
  templateId?: string
  occurrenceDate?: string
  plannedFor?: string
  completedAt?: string
  paused?: boolean
  resumeFrom?: string
}

export type Prefs = {
  palette?: 'violet' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'desert' | 'midnight'
  theme: 'dark' | 'light'
  cutoff: string
  compact: boolean
  reminders: boolean
}

export type Session = {
  taskId: string
  remaining: number
  duration: number
  running: boolean
  endsAt?: number
  completionNotified?: boolean
}

export type CloudTaskChange =
  | { type: 'added' | 'modified'; task: Task }
  | { type: 'removed'; id: string }

export function applyCloudTaskChanges(current: Task[], changes: CloudTaskChange[]) {
  if (changes.length === 0) return current
  const byId = new Map(current.map(task => [task.id, task]))
  for (const change of changes) {
    if (change.type === 'removed') byId.delete(change.id)
    else byId.set(change.task.id, change.task)
  }
  return [...byId.values()]
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const isDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !datePattern.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

export function isTaskList(value: unknown): value is Task[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every(task => {
    if (!task || typeof task !== 'object') return false
    const item = task as Task
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) return false
    ids.add(item.id)
    return typeof item.title === 'string' && item.title.trim().length > 0 &&
      typeof item.project === 'string' && isDateKey(item.date) &&
      typeof item.time === 'string' && (item.time === '' || timePattern.test(item.time)) &&
      typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration >= 0 && item.duration <= 1440 &&
      typeof item.completed === 'boolean' && typeof item.recurring === 'boolean' &&
      typeof item.recurrence === 'string' && typeof item.notes === 'string' && typeof item.color === 'string' &&
      (item.templateId === undefined || typeof item.templateId === 'string') &&
      (item.occurrenceDate === undefined || isDateKey(item.occurrenceDate)) &&
      (item.plannedFor === undefined || isDateKey(item.plannedFor)) &&
      (item.completedAt === undefined || isDateKey(item.completedAt)) &&
      (item.paused === undefined || typeof item.paused === 'boolean') &&
      (item.resumeFrom === undefined || isDateKey(item.resumeFrom))
  })
}

export function isPrefs(value: unknown): value is Prefs {
  if (!value || typeof value !== 'object') return false
  const prefs = value as Prefs
  return (prefs.theme === 'dark' || prefs.theme === 'light') &&
    (prefs.palette === undefined || ['violet', 'ocean', 'forest', 'sunset', 'rose', 'desert', 'midnight'].includes(prefs.palette)) &&
    typeof prefs.cutoff === 'string' && timePattern.test(prefs.cutoff) &&
    typeof prefs.compact === 'boolean' && typeof prefs.reminders === 'boolean'
}

export function isSession(value: unknown): value is Session | null {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const session = value as Session
  return typeof session.taskId === 'string' && session.taskId.length > 0 &&
    typeof session.duration === 'number' && Number.isFinite(session.duration) && session.duration > 0 &&
    typeof session.remaining === 'number' && Number.isFinite(session.remaining) &&
    typeof session.running === 'boolean' &&
    (session.endsAt === undefined || (typeof session.endsAt === 'number' && Number.isFinite(session.endsAt))) &&
    (session.completionNotified === undefined || typeof session.completionNotified === 'boolean')
}
