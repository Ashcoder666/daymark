import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "./firebase";
import { isPrefs, isSession, isTaskList } from "./model";
import type { CloudTaskChange, Prefs, Session, Task } from "./model";

export type CloudWorkspace = {
  tasks: Task[];
  prefs: Prefs;
  session: Session | null;
};

type CloudListeners = {
  onTasks: (tasks: Task[], changes: CloudTaskChange[]) => void;
  onPrefs: (prefs: Prefs) => void;
  onSession: (session: Session | null) => void;
  onError: (error: Error) => void;
};

const requireFirestore = () => {
  if (!firestore) throw new Error("Firebase is not configured.");
  return firestore;
};

const userRoot = (uid: string) => `users/${uid}`;

const taskPayload = (task: Task) => {
  const payload: Record<string, string | number | boolean> = {
    id: task.id,
    title: task.title,
    project: task.project,
    date: task.date,
    time: task.time,
    duration: task.duration,
    completed: task.completed,
    recurring: task.recurring,
    recurrence: task.recurrence,
    notes: task.notes,
    color: task.color,
  };
  if (task.templateId !== undefined) payload.templateId = task.templateId;
  if (task.occurrenceDate !== undefined)
    payload.occurrenceDate = task.occurrenceDate;
  if (task.plannedFor !== undefined) payload.plannedFor = task.plannedFor;
  if (task.completedAt !== undefined) payload.completedAt = task.completedAt;
  if (task.paused !== undefined) payload.paused = task.paused;
  if (task.resumeFrom !== undefined) payload.resumeFrom = task.resumeFrom;
  return payload;
};

const sessionPayload = (session: Session) => {
  const payload: Record<string, string | number | boolean> = {
    taskId: session.taskId,
    remaining: session.remaining,
    duration: session.duration,
    running: session.running,
  };
  if (session.endsAt !== undefined) payload.endsAt = session.endsAt;
  if (session.completionNotified !== undefined)
    payload.completionNotified = session.completionNotified;
  return payload;
};

const readTaskDocuments = (
  docs: { id: string; data: () => unknown }[],
): Task[] => {
  const tasks = docs.map((item) => ({
    ...(item.data() as Record<string, unknown>),
    id: item.id,
  }));
  if (!isTaskList(tasks)) throw new Error("Cloud tasks failed validation.");
  return tasks;
};

export async function initializeCloudWorkspace(
  uid: string,
  local: CloudWorkspace,
): Promise<CloudWorkspace> {
  const db = requireFirestore();
  const root = userRoot(uid);
  const tasksRef = collection(db, `${root}/tasks`);
  const prefsRef = doc(db, `${root}/settings/preferences`);
  const sessionRef = doc(db, `${root}/state/focus`);
  const migrationRef = doc(db, `${root}/meta/local-v1`);

  const [taskSnapshot, prefsSnapshot, sessionSnapshot, migrationSnapshot] =
    await Promise.all([
      getDocs(tasksRef),
      getDoc(prefsRef),
      getDoc(sessionRef),
      getDoc(migrationRef),
    ]);

  const remoteTasks = readTaskDocuments(taskSnapshot.docs);
  const remotePrefs = prefsSnapshot.exists() ? prefsSnapshot.data() : null;
  const remoteSession = sessionSnapshot.exists()
    ? sessionSnapshot.data().value
    : null;

  if (remotePrefs !== null && !isPrefs(remotePrefs))
    throw new Error("Cloud preferences failed validation.");
  if (!isSession(remoteSession))
    throw new Error("Cloud focus state failed validation.");

  if (migrationSnapshot.exists()) {
    return {
      tasks: remoteTasks,
      prefs: remotePrefs ?? local.prefs,
      session: remoteSession,
    };
  }

  const remoteIds = new Set(remoteTasks.map((task) => task.id));
  const localOnly = local.tasks.filter((task) => !remoteIds.has(task.id));
  const batch = writeBatch(db);
  for (const task of localOnly) {
    batch.set(doc(tasksRef, task.id), taskPayload(task));
  }
  if (!prefsSnapshot.exists()) batch.set(prefsRef, local.prefs);
  if (!sessionSnapshot.exists() && local.session !== null)
    batch.set(sessionRef, { value: sessionPayload(local.session) });
  batch.set(migrationRef, {
    schemaVersion: 1,
    migratedAt: serverTimestamp(),
  });
  await batch.commit();

  return {
    tasks: [...remoteTasks, ...localOnly],
    prefs: remotePrefs ?? local.prefs,
    session: sessionSnapshot.exists() ? remoteSession : local.session,
  };
}

export function subscribeCloudWorkspace(
  uid: string,
  listeners: CloudListeners,
) {
  const db = requireFirestore();
  const root = userRoot(uid);
  const stopTasks = onSnapshot(
    collection(db, `${root}/tasks`),
    (snapshot) => {
      try {
        const tasks = readTaskDocuments(snapshot.docs);
        const changes: CloudTaskChange[] = snapshot.docChanges().map((change) => {
          if (change.type === "removed")
            return { type: "removed", id: change.doc.id };
          const [task] = readTaskDocuments([change.doc]);
          return { type: change.type, task };
        });
        listeners.onTasks(tasks, changes);
      } catch (error) {
        listeners.onError(error as Error);
      }
    },
    (error) => listeners.onError(error),
  );
  const stopPrefs = onSnapshot(
    doc(db, `${root}/settings/preferences`),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const value = snapshot.data();
      if (isPrefs(value)) listeners.onPrefs(value);
      else listeners.onError(new Error("Cloud preferences failed validation."));
    },
    (error) => listeners.onError(error),
  );
  const stopSession = onSnapshot(
    doc(db, `${root}/state/focus`),
    (snapshot) => {
      const value = snapshot.exists() ? snapshot.data().value : null;
      if (isSession(value)) listeners.onSession(value);
      else listeners.onError(new Error("Cloud focus state failed validation."));
    },
    (error) => listeners.onError(error),
  );
  return () => {
    stopTasks();
    stopPrefs();
    stopSession();
  };
}

export async function saveCloudTasks(
  uid: string,
  previous: Task[],
  next: Task[],
) {
  const db = requireFirestore();
  const tasksRef = collection(db, `${userRoot(uid)}/tasks`);
  const previousById = new Map(previous.map((task) => [task.id, task]));
  const nextIds = new Set(next.map((task) => task.id));
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const task of next) {
    const old = previousById.get(task.id);
    if (old && JSON.stringify(old) === JSON.stringify(task)) continue;
    operations.push((batch) =>
      batch.set(doc(tasksRef, task.id), taskPayload(task)),
    );
  }
  for (const task of previous) {
    if (!nextIds.has(task.id))
      operations.push((batch) => batch.delete(doc(tasksRef, task.id)));
  }

  for (let index = 0; index < operations.length; index += 450) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(index, index + 450))
      operation(batch);
    await batch.commit();
  }
}

export async function saveCloudPrefs(uid: string, prefs: Prefs) {
  const db = requireFirestore();
  await setDoc(doc(db, `${userRoot(uid)}/settings/preferences`), prefs);
}

export async function saveCloudSession(
  uid: string,
  session: Session | null,
) {
  const db = requireFirestore();
  const reference = doc(db, `${userRoot(uid)}/state/focus`);
  if (session === null) await deleteDoc(reference);
  else await setDoc(reference, { value: sessionPayload(session) });
}
