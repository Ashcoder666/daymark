import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { Store } from '@tauri-apps/plugin-store'
import type { Prefs, Session, Task } from './model'

export const inDesktopApp = isTauri()

let storePromise: Promise<Store> | undefined
let saveQueue = Promise.resolve()

function appStore() {
  storePromise ??= Store.load('daymark.json', { autoSave: false })
  return storePromise
}

export async function loadNativeData() {
  const store = await appStore()
  return {
    tasks: await store.get<Task[]>('tasks') ?? null,
    prefs: await store.get<Prefs>('prefs') ?? null,
    session: await store.get<Session | null>('session') ?? null,
  }
}

export function saveNativeData(tasks: Task[], prefs: Prefs, session: Session | null) {
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    const store = await appStore()
    await store.set('tasks', tasks)
    await store.set('prefs', prefs)
    await store.set('session', session)
    await store.save()
  })
  return saveQueue
}

export async function notifyDesktop(title: string, body: string) {
  if (!inDesktopApp) return
  try {
    let allowed = await isPermissionGranted()
    if (!allowed) allowed = (await requestPermission()) === 'granted'
    if (allowed) await sendNotification({ title, body })
  } catch (error) {
    console.warn('Daymark notification unavailable', error)
  }
}

export async function windowAction(action: 'minimize' | 'maximize' | 'close' | 'drag') {
  if (!inDesktopApp) return
  const window = getCurrentWindow()
  if (action === 'minimize') await window.minimize()
  if (action === 'maximize') await window.toggleMaximize()
  if (action === 'close') await window.close()
  if (action === 'drag') await window.startDragging()
}
