import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Ellipsis,
  Flame,
  Focus,
  History,
  LayoutGrid,
  LogOut,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useDaymarkAuth } from "./AuthGate";
import { ThemeScene } from "./ThemeScene";
import './scenery.css';
import {
  initializeCloudWorkspace,
  saveCloudPrefs,
  saveCloudSession,
  saveCloudTasks,
  subscribeCloudWorkspace,
} from "./cloud";
import {
  inDesktopApp,
  loadNativeData,
  notifyDesktop,
  saveNativeData,
  windowAction,
} from "./desktop";
import { generateOccurrences } from "./recurrence";
import {
  applyCloudTaskChanges,
  isPrefs,
  isSession,
  isTaskList,
} from "./model";
import type { Prefs, Session, Task } from "./model";
import "./App.css";

type Page =
  "Today" | "Calendar" | "Pending" | "Recurring" | "History" | "Settings";
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const asDate = (key: string) => new Date(`${key}T12:00:00`);
const shifted = (key: string, n: number) => {
  const d = asDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
const dateLabel = (key: string, options: Intl.DateTimeFormatOptions) =>
  asDate(key).toLocaleDateString("en-US", options);
const durationLabel = (n: number) =>
  n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n}m`;
const clock = (n: number) =>
  [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
const read = <T,>(key: string, initial: () => T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : initial();
  } catch {
    return initial();
  }
};
const sameData = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);
export const sampleTasks = (): Task[] => {
  const today = dateKey(new Date());
  const yesterday = shifted(today, -1);
  return [
    {
      id: "1",
      title: "Review the week and choose priorities",
      project: "Personal",
      date: today,
      time: "09:00",
      duration: 30,
      completed: true,
      recurring: true,
      recurrence: "Every weekday",
      notes: "",
      color: "violet",
    },
    {
      id: "2",
      title: "Study AWS Lambda",
      project: "AWS Learning",
      date: today,
      time: "10:00",
      duration: 60,
      completed: false,
      recurring: true,
      recurrence: "Every weekday",
      notes: "Work through one hands-on lesson.",
      color: "blue",
    },
    {
      id: "3",
      title: "Build startup landing page",
      project: "Startup",
      date: today,
      time: "14:00",
      duration: 120,
      completed: false,
      recurring: false,
      recurrence: "",
      notes: "",
      color: "violet",
    },
    {
      id: "4",
      title: "Practice data structures",
      project: "Learning",
      date: today,
      time: "",
      duration: 45,
      completed: false,
      recurring: true,
      recurrence: "Every weekday",
      notes: "",
      color: "cyan",
    },
    {
      id: "5",
      title: "Review GitHub project",
      project: "Development",
      date: today,
      time: "",
      duration: 30,
      completed: false,
      recurring: false,
      recurrence: "",
      notes: "",
      color: "amber",
    },
    {
      id: "6",
      title: "Complete AWS S3 exercises",
      project: "AWS Learning",
      date: yesterday,
      time: "",
      duration: 45,
      completed: false,
      recurring: false,
      recurrence: "",
      notes: "",
      color: "blue",
    },
    {
      id: "7",
      title: "Review startup architecture",
      project: "Startup",
      date: shifted(today, -2),
      time: "",
      duration: 60,
      completed: false,
      recurring: false,
      recurrence: "",
      notes: "",
      color: "violet",
    },
    {
      id: "8",
      title: "Plan the next sprint",
      project: "Startup",
      date: yesterday,
      time: "16:00",
      duration: 30,
      completed: true,
      recurring: false,
      recurrence: "",
      notes: "",
      color: "violet",
    },
  ];
};
const navigation: { page: Page; icon: typeof LayoutGrid }[] = [
  { page: "Today", icon: LayoutGrid },
  { page: "Calendar", icon: CalendarDays },
  { page: "Pending", icon: Circle },
  { page: "Recurring", icon: RotateCcw },
  { page: "History", icon: History },
  { page: "Settings", icon: Settings2 },
];

function App() {
  const { user, signOut } = useDaymarkAuth();
  const [page, setPage] = useState<Page>("Today");
  const [tasks, setTasks] = useState<Task[]>(() => {
    const stored = read<unknown>("daymark.tasks.v1", () => []);
    return isTaskList(stored) ? stored : [];
  });
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const stored = read<unknown>("daymark.prefs.v1", () => null);
    return isPrefs(stored)
      ? stored
      : { theme: "dark", cutoff: "00:00", compact: false, reminders: true };
  });
  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [editor, setEditor] = useState<Task | "new" | null>(null);
  const [session, setSession] = useState<Session | null>(() => {
    const stored = read<unknown>("daymark.session.v1", () => null);
    return isSession(stored) ? stored : null;
  });
  const [ready, setReady] = useState(!inDesktopApp);
  const [nativeStorageReady, setNativeStorageReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [cloudAttempt, setCloudAttempt] = useState(0);
  const cloudTasks = useRef<Task[]>([]);
  const cloudPrefs = useRef<Prefs | null>(null);
  const cloudSession = useRef<Session | null>(null);
  const cloudWriteQueue = useRef(Promise.resolve());
  const cloudErrorShown = useRef(false);
  const remindersSeen = useRef(new Set<string>());
  const storageErrorShown = useRef(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [suggestions, setSuggestions] = useState(false);
  const [query, setQuery] = useState("");
  const today = dateKey(now);
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.date === today || t.plannedFor === today),
    [tasks, today],
  );
  const pending = useMemo(
    () =>
      tasks.filter(
        (t) => !t.completed && t.date < today && t.plannedFor !== today,
      ),
    [tasks, today],
  );
  const open = todayTasks.filter((t) => !t.completed);
  const done = todayTasks.length - open.length;
  const workLeft = [...open, ...pending].reduce(
    (sum, t) => sum + t.duration,
    0,
  );
  const cutoff = new Date(now);
  const [hours, minutes] = prefs.cutoff.split(":").map(Number);
  cutoff.setHours(hours, minutes, 0, 0);
  if (cutoff <= now) cutoff.setDate(cutoff.getDate() + 1);
  const secondsLeft = Math.max(
    0,
    Math.floor((cutoff.getTime() - now.getTime()) / 1000),
  );
  const dayProgress = Math.max(
    0,
    Math.min(100, 100 - (secondsLeft / 86400) * 100),
  );
  const activeTask = tasks.find((t) => t.id === session?.taskId);
  const focusRemaining = session
    ? session.running && session.endsAt
      ? Math.ceil((session.endsAt - now.getTime()) / 1000)
      : session.remaining
    : 0;
  const visible = todayTasks.filter((t) =>
    `${t.title} ${t.project}`.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!inDesktopApp) return;
    let cancelled = false;
    loadNativeData()
      .then((data) => {
        if (cancelled) return;
        if (data.tasks !== null && !isTaskList(data.tasks))
          throw new Error("Stored tasks failed validation");
        if (data.prefs !== null && !isPrefs(data.prefs))
          throw new Error("Stored preferences failed validation");
        if (data.session !== null && !isSession(data.session))
          throw new Error("Stored session failed validation");
        if (data.tasks) setTasks(data.tasks);
        if (data.prefs) setPrefs(data.prefs);
        if (data.session) setSession(data.session);
        setNativeStorageReady(true);
        setReady(true);
      })
      .catch((error) => {
        console.error("Daymark data could not be loaded", error);
        if (!cancelled) {
          setToast(
            "Native data could not be loaded. The saved file was not changed.",
          );
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let stopListening: () => void = () => undefined;
    let retryTimer: number | undefined;
    setCloudReady(false);

    void initializeCloudWorkspace(user.uid, { tasks, prefs, session })
      .then((workspace) => {
        if (cancelled) return;
        cloudTasks.current = workspace.tasks;
        cloudPrefs.current = workspace.prefs;
        cloudSession.current = workspace.session;
        setTasks(workspace.tasks);
        setPrefs(workspace.prefs);
        setSession(workspace.session);
        setCloudReady(true);
        setCloudError("");
        stopListening = subscribeCloudWorkspace(user.uid, {
          onTasks: (next, changes) => {
            cloudTasks.current = next;
            setTasks((current) => applyCloudTaskChanges(current, changes));
          },
          onPrefs: (next) => {
            cloudPrefs.current = next;
            setPrefs((current) => (sameData(current, next) ? current : next));
          },
          onSession: (next) => {
            cloudSession.current = next;
            setSession((current) => (sameData(current, next) ? current : next));
          },
          onError: (error) => {
            console.error("Daymark cloud sync failed", error);
            if (!cloudErrorShown.current) {
              cloudErrorShown.current = true;
              setToast("Cloud sync paused. Your local copy is still safe.");
            }
          },
        });
      })
      .catch((error) => {
        console.error("Daymark cloud data could not be loaded", error);
        if (!cancelled) {
          const detail = typeof error?.code === 'string' ? error.code : error instanceof Error ? error.message : 'Unknown error';
          setCloudError(detail);
          setToast(`Cloud sync: ${detail}`);
          retryTimer = window.setTimeout(
            () => setCloudAttempt((attempt) => attempt + 1),
            15_000,
          );
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      stopListening();
    };
  }, [ready, user.uid, cloudAttempt]);
  useEffect(() => {
    if (ready) localStorage.setItem("daymark.tasks.v1", JSON.stringify(tasks));
  }, [tasks, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem("daymark.prefs.v1", JSON.stringify(prefs));
  }, [prefs, ready]);
  useEffect(() => {
    if (ready)
      localStorage.setItem("daymark.session.v1", JSON.stringify(session));
  }, [session, ready]);
  useEffect(() => {
    if (!ready || !nativeStorageReady) return;
    void saveNativeData(tasks, prefs, session).catch((error) => {
      console.error("Daymark data could not be saved", error);
      if (!storageErrorShown.current) {
        storageErrorShown.current = true;
        setToast("Native data could not be saved. Check your app storage.");
      }
    });
  }, [tasks, prefs, session, ready, nativeStorageReady]);
  useEffect(() => {
    if (!cloudReady) return;
    const next = tasks;
    cloudWriteQueue.current = cloudWriteQueue.current
      .catch(() => undefined)
      .then(async () => {
        const previous = cloudTasks.current;
        if (sameData(previous, next)) return;
        await saveCloudTasks(user.uid, previous, next);
        cloudTasks.current = next;
      })
      .catch((error) => {
        console.error("Daymark tasks could not be synced", error);
        setToast("Task sync failed. Daymark will retry after your next change.");
      });
  }, [tasks, cloudReady, user.uid]);
  useEffect(() => {
    if (!cloudReady) return;
    const next = prefs;
    cloudWriteQueue.current = cloudWriteQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (sameData(cloudPrefs.current, next)) return;
        await saveCloudPrefs(user.uid, next);
        cloudPrefs.current = next;
      })
      .catch((error) => {
        console.error("Daymark preferences could not be synced", error);
        setToast("Settings sync failed. Daymark will retry after your next change.");
      });
  }, [prefs, cloudReady, user.uid]);
  useEffect(() => {
    if (!cloudReady) return;
    const next = session;
    cloudWriteQueue.current = cloudWriteQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (sameData(cloudSession.current, next)) return;
        await saveCloudSession(user.uid, next);
        cloudSession.current = next;
      })
      .catch((error) => {
        console.error("Daymark focus session could not be synced", error);
        setToast("Focus sync failed. Daymark will retry after your next change.");
      });
  }, [session, cloudReady, user.uid]);
  useEffect(() => {
    if (ready) setTasks((current) => generateOccurrences(current, today));
  }, [today, ready]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditor("new");
      }
      if (e.key === "Escape") {
        setEditor(null);
        setMenu(null);
        setSuggestions(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (
      !ready ||
      !session?.running ||
      session.completionNotified ||
      focusRemaining > 0
    )
      return;
    setSession((current) =>
      current ? { ...current, completionNotified: true } : null,
    );
    setToast("Focus estimate reached. Keep going or mark the task complete.");
    if (prefs.reminders)
      void notifyDesktop(
        "Focus estimate reached",
        activeTask?.title ?? "Your session is ready to complete.",
      );
  }, [
    focusRemaining,
    session?.running,
    session?.completionNotified,
    activeTask?.title,
    prefs.reminders,
    ready,
  ]);
  useEffect(() => {
    if (!ready || !prefs.reminders) return;
    const localTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    for (const task of tasks) {
      const reminderKey = `${task.id}:${today}:${localTime}`;
      if (
        task.date === today &&
        !task.completed &&
        task.time === localTime &&
        !remindersSeen.current.has(reminderKey)
      ) {
        remindersSeen.current.add(reminderKey);
        setToast(`Time for ${task.title}`);
        void notifyDesktop(
          `Time for ${task.title}`,
          "Your planned session starts now.",
        );
      }
    }
  }, [now, tasks, prefs.reminders, today, ready]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  const update = (task: Task) =>
    setTasks((list) =>
      generateOccurrences(
        list.map((t) => (t.id === task.id ? task : t)),
        today,
      ),
    );
  const complete = (task: Task) => {
    update({
      ...task,
      completed: !task.completed,
      completedAt: task.completed ? undefined : today,
    });
    if (session?.taskId === task.id) setSession(null);
    setToast(
      task.completed ? "Task reopened." : "Task completed. Keep the momentum.",
    );
  };
  const focus = (task: Task) => {
    const seconds = Math.max(60, task.duration * 60);
    setSession({
      taskId: task.id,
      remaining: seconds,
      duration: seconds,
      running: true,
      endsAt: Date.now() + seconds * 1000,
      completionNotified: false,
    });
    setToast(`Focusing on ${task.title}`);
  };
  const moveToday = (task: Task) => {
    update({ ...task, plannedFor: today });
    setToast("Moved to today’s plan. Original date preserved.");
  };
  const save = (task: Task) => {
    setTasks((list) =>
      generateOccurrences(
        list.some((t) => t.id === task.id)
          ? list.map((t) => (t.id === task.id ? task : t))
          : [...list, task],
        today,
      ),
    );
    setEditor(null);
    setToast("Task saved.");
  };
  const remove = (task: Task) => {
    setTasks((list) => list.filter((t) => t.id !== task.id));
    setMenu(null);
    if (session?.taskId === task.id) setSession(null);
    setToast("Task removed.");
  };
  const TaskRow = ({
    task,
    showDate = false,
  }: {
    task: Task;
    showDate?: boolean;
  }) => (
    <div className={`task-row ${task.completed ? "is-complete" : ""}`}>
      <button
        className={`task-check ${task.completed ? "checked" : ""}`}
        onClick={() => complete(task)}
        aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}
      >
        {task.completed && <Check size={13} strokeWidth={3} />}
      </button>
      <span className={`task-color ${task.color}`} />
      <div className="task-copy">
        <strong>{task.title}</strong>
        <div className="task-meta">
          <span>{task.project || "Personal"}</span>
          {showDate && (
            <>
              <i />
              <span>
                {dateLabel(task.date, { month: "short", day: "numeric" })}
              </span>
            </>
          )}
          {task.time && (
            <>
              <i />
              <span>
                {new Date(`2000-01-01T${task.time}:00`).toLocaleTimeString(
                  "en-US",
                  { hour: "numeric", minute: "2-digit" },
                )}
              </span>
            </>
          )}
          {task.duration > 0 && (
            <>
              <i />
              <span>{durationLabel(task.duration)}</span>
            </>
          )}
        </div>
      </div>
      {!task.completed && (
        <button className="row-focus" onClick={() => focus(task)}>
          <Play size={13} fill="currentColor" />
          <span>Focus</span>
        </button>
      )}
      <div className="menu-wrap">
        <button
          className="icon-btn task-more"
          onClick={() => setMenu(menu === task.id ? null : task.id)}
          aria-label={`More options for ${task.title}`}
        >
          <Ellipsis size={18} />
        </button>
        {menu === task.id && (
          <div className="context-menu">
            <button
              onClick={() => {
                setEditor(task);
                setMenu(null);
              }}
            >
              Edit task
            </button>
            <button
              onClick={() => {
                update({ ...task, date: shifted(today, 1) });
                setMenu(null);
                setToast("Moved to tomorrow.");
              }}
            >
              Move to tomorrow
            </button>
            <button className="danger" onClick={() => remove(task)}>
              Delete task
            </button>
          </div>
        )}
      </div>
    </div>
  );
  const Empty = ({
    icon: Icon,
    title,
    detail,
  }: {
    icon: typeof Circle;
    title: string;
    detail: string;
  }) => (
    <div className="empty-state">
      <Icon size={27} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
  const PageHeader = ({
    eyebrow,
    title,
    description,
    action,
  }: {
    eyebrow: string;
    title: string;
    description: string;
    action?: string;
  }) => (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <i />
          {eyebrow}
        </div>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary-btn" onClick={() => setEditor("new")}>
          <Plus size={17} />
          {action}
        </button>
      )}
    </div>
  );
  return (
    <div className={`app ${inDesktopApp ? "desktop-app" : "web-app"} ${prefs.theme} palette-${prefs.palette ?? "violet"} ${prefs.compact ? "compact" : ""}`}>
      <ThemeScene palette={prefs.palette ?? 'violet'} />
      <div
        className="window-bar"
        onMouseDown={(event) => {
          if (event.button === 0 && event.target === event.currentTarget)
            void windowAction("drag");
        }}
        onDoubleClick={() => void windowAction("maximize")}
      >
        <div
          className="window-brand"
          onMouseDown={() => void windowAction("drag")}
        >
          <span className="brand-mark small">
            <span />
          </span>
          <span>Daymark</span>
          <i />
          <span className="window-context">Personal workspace</span>
        </div>
        <div className="window-controls">
          <button
            className="minimize"
            aria-label="Minimize window"
            title="Minimize"
            onClick={() => void windowAction("minimize")}
          />
          <button
            className="maximize"
            aria-label="Maximize window"
            title="Maximize"
            onClick={() => void windowAction("maximize")}
          />
          <button
            className="close-cross"
            aria-label="Close window"
            title="Close"
            onClick={() => void windowAction("close")}
          >
            ×
          </button>
        </div>
      </div>
      <div className="shell">
        <aside className="sidebar">
          <div>
            <div className="logo">
              <span className="brand-mark">
                <span />
              </span>
              <div>
                <strong>daymark</strong>
                <small>MAKE TODAY COUNT</small>
              </div>
            </div>
            <div className="sidebar-label">WORKSPACE</div>
            <nav aria-label="Primary navigation">
              {navigation.slice(0, 5).map(({ page: item, icon: Icon }) => (
                <button
                  key={item}
                  className={`nav-item ${page === item ? "active" : ""}`}
                  onClick={() => setPage(item)}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{item}</span>
                  {item === "Pending" && pending.length > 0 && (
                    <b>{pending.length}</b>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-label second-label">PREFERENCES</div>
            <button
              className={`nav-item ${page === "Settings" ? "active" : ""}`}
              onClick={() => setPage("Settings")}
            >
              <Settings2 size={18} />
              <span>Settings</span>
            </button>
          </div>
          <div className="sidebar-bottom">
            <div className="sidebar-quote">
              <Sparkles size={16} />
              <p>A little progress, every day.</p>
            </div>
            <button
              className="sidebar-user"
              type="button"
              onClick={() => setPage("Settings")}
            >
              <div className="avatar">
                {(user.email?.[0] ?? "A").toUpperCase()}
              </div>
              <div>
                <strong>{user.email?.split("@")[0] ?? "My workspace"}</strong>
                <small>Firebase account</small>
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="breadcrumbs">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <div className="top-actions">
              <button
                className="theme-switch"
                type="button"
                aria-label={
                  prefs.theme === "dark"
                    ? "Switch to white mode"
                    : "Switch to dark mode"
                }
                aria-pressed={prefs.theme === "light"}
                title={
                  prefs.theme === "dark"
                    ? "Switch to white mode"
                    : "Switch to dark mode"
                }
                onClick={() =>
                  setPrefs((current) => ({
                    ...current,
                    theme: current.theme === "dark" ? "light" : "dark",
                  }))
                }
              >
                {prefs.theme === "dark" ? (
                  <Sun size={15} />
                ) : (
                  <Moon size={15} />
                )}
                <span>
                  {prefs.theme === "dark" ? "White mode" : "Dark mode"}
                </span>
              </button>
              <button
                className="icon-btn"
                title="Search tasks"
                onClick={() => {
                  setPage("Today");
                  setTimeout(
                    () => document.getElementById("task-search")?.focus(),
                    0,
                  );
                }}
              >
                <Search size={18} />
              </button>
              <button
                className="icon-btn"
                title="Notifications"
                onClick={() => setToast("You’re all caught up.")}
              >
                <Bell size={18} />
              </button>
              <i />
              <span>
                {dateLabel(today, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </header>
          {page === "Today" && (
            <div className="content today-content">
              <PageHeader
                eyebrow="YOUR DAILY SPACE"
                title="Make today count"
                description={`${dateLabel(today, { weekday: "long", month: "long", day: "numeric" })}  ·  A fresh day to make progress`}
                action="Add task"
              />
              <div className="hero-grid">
                <section className="countdown-card">
                  <div className="card-top">
                    <div className="section-kicker">
                      <span className="kicker-icon">
                        <Clock3 size={16} />
                      </span>
                      TIME LEFT TODAY
                    </div>
                    <span className="live-badge">
                      <i />
                      LIVE
                    </span>
                  </div>
                  <div className="countdown">
                    {clock(secondsLeft)
                      .split(":")
                      .map((part, i) => (
                        <span key={i}>
                          {i > 0 && <em>:</em>}
                          {part}
                        </span>
                      ))}
                  </div>
                  <div className="time-labels">
                    <span>HOURS</span>
                    <span>MINUTES</span>
                    <span>SECONDS</span>
                  </div>
                  <div className="day-track">
                    <div style={{ width: `${dayProgress}%` }} />
                  </div>
                  <div className="day-track-meta">
                    <span>Day in progress</span>
                    <span>{Math.round(dayProgress)}% elapsed</span>
                  </div>
                </section>
                <section className="progress-card">
                  <div className="section-kicker">
                    <span className="kicker-icon violet-bg">
                      <Activity size={16} />
                    </span>
                    DAILY PROGRESS
                  </div>
                  <div className="progress-main">
                    <div>
                      <strong>
                        {done}
                        <span> / {todayTasks.length}</span>
                      </strong>
                      <p>tasks completed</p>
                    </div>
                    <div
                      className="progress-ring"
                      style={
                        {
                          "--ring": `${todayTasks.length ? (done / todayTasks.length) * 100 : 0}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span>
                        {todayTasks.length
                          ? Math.round((done / todayTasks.length) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                  <div className="progress-divider" />
                  <div className="mini-metrics">
                    <div>
                      <i className="green" />
                      {done} done
                    </div>
                    <div>
                      <i className="violet" />
                      {open.length} remaining
                    </div>
                    <div>
                      <Clock3 size={14} />
                      {durationLabel(workLeft)} left
                    </div>
                  </div>
                </section>
              </div>
              <div className="section-heading">
                <div>
                  <h2>Today’s plan</h2>
                  <p>Your focus, one task at a time</p>
                </div>
                <div className="section-actions">
                  <div className="search-field">
                    <Search size={15} />
                    <input
                      id="task-search"
                      placeholder="Find a task"
                      aria-label="Find a task"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <button
                    className="subtle-btn"
                    onClick={() => setEditor("new")}
                  >
                    <Plus size={16} />
                    Add task
                  </button>
                </div>
              </div>
              <section className="task-card">
                {visible.length ? (
                  <>
                    <div className="list-caption">
                      <span>
                        TO DO{" "}
                        <b>{visible.filter((t) => !t.completed).length}</b>
                      </span>
                      <span>
                        EST.{" "}
                        {durationLabel(
                          open.reduce((sum, t) => sum + t.duration, 0),
                        )}
                      </span>
                    </div>
                    {visible
                      .filter((t) => !t.completed)
                      .map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          showDate={t.date < today}
                        />
                      ))}
                    {visible.some((t) => t.completed) && (
                      <div className="list-caption completed-caption">
                        <span>
                          COMPLETED{" "}
                          <b>{visible.filter((t) => t.completed).length}</b>
                        </span>
                        <CheckCircle2 size={15} />
                      </div>
                    )}
                    {visible
                      .filter((t) => t.completed)
                      .map((t) => (
                        <TaskRow key={t.id} task={t} />
                      ))}
                  </>
                ) : (
                  <Empty
                    icon={CheckCircle2}
                    title={query ? "No matching tasks" : "Your plan is clear"}
                    detail={
                      query
                        ? "Try a different search."
                        : "Add a task to begin shaping your day."
                    }
                  />
                )}
              </section>
              <div className="bottom-note">
                <span>
                  <Command size={13} /> + N to add a task
                </span>
                <span>Keep showing up. It adds up.</span>
              </div>
            </div>
          )}
          {page === "Calendar" && (
            <div className="content secondary-content">
              <PageHeader
                eyebrow="LOOK AHEAD"
                title="Your calendar"
                description="See what you planned, finished, and carried forward."
                action="Add task"
              />
              <div className="calendar-layout">
                <section className="panel calendar-panel">
                  <div className="calendar-head">
                    <h2>
                      {new Date(
                        calendarYear,
                        calendarMonth,
                        1,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <div>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          const d = new Date(calendarYear, calendarMonth - 1);
                          setCalendarYear(d.getFullYear());
                          setCalendarMonth(d.getMonth());
                        }}
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          const d = new Date(calendarYear, calendarMonth + 1);
                          setCalendarYear(d.getFullYear());
                          setCalendarMonth(d.getMonth());
                        }}
                        aria-label="Next month"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="calendar-grid">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <span key={i} className="weekday">
                        {d}
                      </span>
                    ))}
                    {Array.from(
                      {
                        length: new Date(
                          calendarYear,
                          calendarMonth,
                          1,
                        ).getDay(),
                      },
                      (_, i) => (
                        <span key={`blank-${i}`} />
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          calendarYear,
                          calendarMonth + 1,
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const d = dateKey(
                          new Date(calendarYear, calendarMonth, i + 1),
                        );
                        return (
                          <button
                            key={d}
                            className={`calendar-day ${d === today ? "today" : ""} ${d === selectedDate ? "selected" : ""}`}
                            onClick={() => setSelectedDate(d)}
                          >
                            <span>{i + 1}</span>
                            {tasks.some((t) => t.date === d) && <i />}
                          </button>
                        );
                      },
                    )}
                  </div>
                  <div className="calendar-legend">
                    <span>
                      <i />
                      Tasks planned
                    </span>
                    <span className="legend-today">Today</span>
                  </div>
                </section>
                <section className="panel selected-day">
                  <div className="eyebrow">SELECTED DAY</div>
                  <h2>
                    {dateLabel(selectedDate, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h2>
                  <p>
                    {tasks.filter((t) => t.date === selectedDate).length} tasks
                    planned ·{" "}
                    {
                      tasks.filter(
                        (t) => t.date === selectedDate && t.completed,
                      ).length
                    }{" "}
                    completed
                  </p>
                  <div className="selected-list">
                    {tasks
                      .filter((t) => t.date === selectedDate)
                      .map((t) => (
                        <TaskRow key={t.id} task={t} />
                      ))}
                    {!tasks.some((t) => t.date === selectedDate) && (
                      <Empty
                        icon={CalendarDays}
                        title="Nothing planned here"
                        detail="A clear day, or a place to start fresh."
                      />
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
          {page === "Pending" && (
            <div className="content secondary-content">
              <PageHeader
                eyebrow="UNFINISHED WORK"
                title="Pending tasks"
                description="Pick up where you left off, without losing the original day."
              />
              <section className="panel list-page-panel">
                <div className="list-caption">
                  <span>
                    CARRIED FORWARD <b>{pending.length}</b>
                  </span>
                  <span>OLDEST FIRST</span>
                </div>
                {pending.length ? (
                  pending
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((t) => (
                      <div className="pending-row" key={t.id}>
                        <TaskRow task={t} showDate />
                        <button
                          className="move-btn"
                          onClick={() => moveToday(t)}
                        >
                          Move to today <ArrowRight size={15} />
                        </button>
                      </div>
                    ))
                ) : (
                  <Empty
                    icon={CheckCircle2}
                    title="All caught up"
                    detail="There’s no unfinished work from earlier days."
                  />
                )}
              </section>
            </div>
          )}
          {page === "Recurring" && (
            <div className="content secondary-content">
              <PageHeader
                eyebrow="BUILD A RHYTHM"
                title="Recurring tasks"
                description="The small routines that move your work forward."
                action="New routine"
              />
              <section className="panel list-page-panel">
                <div className="list-caption">
                  <span>
                    YOUR ROUTINES{" "}
                    <b>{tasks.filter((t) => t.recurring).length}</b>
                  </span>
                </div>
                {tasks
                  .filter((t) => t.recurring)
                  .map((t) => (
                    <div
                      className={`routine-row ${t.paused ? "paused" : ""}`}
                      key={t.id}
                    >
                      <span className={`routine-icon ${t.color}`}>
                        <RotateCcw size={17} />
                      </span>
                      <div>
                        <strong>{t.title}</strong>
                        <p>
                          {t.paused ? "Paused · " : ""}
                          {t.recurrence || "Every day"} ·{" "}
                          {t.duration ? durationLabel(t.duration) : "Flexible"}{" "}
                          · {t.project || "Personal"}
                        </p>
                      </div>
                      <button
                        className="subtle-btn"
                        onClick={() => {
                          update({
                            ...t,
                            paused: !t.paused,
                            resumeFrom: t.paused ? today : t.resumeFrom,
                          });
                          setToast(
                            t.paused ? "Routine resumed." : "Routine paused.",
                          );
                        }}
                      >
                        {t.paused ? "Resume" : "Pause"}
                      </button>
                      <button
                        className="subtle-btn"
                        onClick={() => setEditor(t)}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                {!tasks.some((t) => t.recurring) && (
                  <Empty
                    icon={RotateCcw}
                    title="No routines yet"
                    detail="Turn a task into a recurring routine to see it here."
                  />
                )}
              </section>
              <p className="page-footnote">
                Recurring tasks generate independent daily occurrences when
                Daymark opens.
              </p>
            </div>
          )}
          {page === "History" && (
            <div className="content secondary-content">
              <PageHeader
                eyebrow="THE JOURNEY"
                title="History"
                description="A clear record of what you finished and what moved on."
              />
              <section className="panel history-panel">
                {Array.from(
                  new Set(
                    tasks.filter((t) => t.date < today).map((t) => t.date),
                  ),
                )
                  .sort()
                  .reverse()
                  .map((date) => (
                    <div className="history-day" key={date}>
                      <div className="history-date">
                        <strong>
                          {dateLabel(date, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </strong>
                        <span>
                          {
                            tasks.filter((t) => t.date === date && t.completed)
                              .length
                          }{" "}
                          of {tasks.filter((t) => t.date === date).length}{" "}
                          complete
                        </span>
                      </div>
                      {tasks
                        .filter((t) => t.date === date)
                        .map((t) => (
                          <TaskRow key={t.id} task={t} />
                        ))}
                    </div>
                  ))}
                {!tasks.some((t) => t.date < today) && (
                  <Empty
                    icon={History}
                    title="Your history starts here"
                    detail="Earlier days will appear as you use Daymark."
                  />
                )}
              </section>
            </div>
          )}
          {page === "Settings" && (
            <div className="content secondary-content">
              <PageHeader
                eyebrow="MAKE IT YOURS"
                title="Settings"
                description="A few thoughtful controls for your daily workspace."
              />
              <div className="settings-grid">
                <section className="panel settings-panel">
                  <div className="settings-title">
                    <UserRound size={18} />
                    <div>
                      <h2>Account</h2>
                      <p>Your private sync identity.</p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>{user.email}</strong>
                      <span>Firebase authentication active</span>
                    </div>
                    <button
                      className="subtle-btn danger-action"
                      type="button"
                      onClick={() => void signOut()}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </section>
                <section className="panel settings-panel">
                  <div className="settings-title">
                    <Sun size={18} />
                    <div>
                      <h2>Appearance</h2>
                      <p>Choose how Daymark feels.</p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Theme</strong>
                      <span>Set the mood for your workspace</span>
                    </div>
                    <div className="segmented">
                      <button
                        className={prefs.theme === "dark" ? "selected" : ""}
                        onClick={() => setPrefs({ ...prefs, theme: "dark" })}
                      >
                        <Moon size={14} />
                        Dark
                      </button>
                      <button
                        className={prefs.theme === "light" ? "selected" : ""}
                        onClick={() => setPrefs({ ...prefs, theme: "light" })}
                      >
                        <Sun size={14} />
                        White
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Compact layout</strong>
                      <span>Fit more tasks on screen</span>
                    </div>
                    <button
                      className={`toggle ${prefs.compact ? "on" : ""}`}
                      onClick={() =>
                        setPrefs({ ...prefs, compact: !prefs.compact })
                      }
                      aria-label="Toggle compact layout"
                    >
                      <i />
                    </button>
                  </div>
                </section>
                <section className="panel settings-panel">
                  <div className="palette-picker" aria-label="Color theme">
                    {(["violet", "ocean", "forest", "sunset", "rose", "desert", "midnight"] as const).map(palette => (
                      <button key={palette} type="button" className={`palette-choice ${palette} ${((prefs.palette ?? "violet") === palette) ? "selected" : ""}`} aria-pressed={(prefs.palette ?? "violet") === palette} onClick={() => setPrefs(current => ({...current, palette}))}>
                        <i />{palette.charAt(0).toUpperCase() + palette.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="settings-title">
                    <Clock3 size={18} />
                    <div>
                      <h2>Daily planning</h2>
                      <p>Shape the boundaries of your day.</p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Day ends at</strong>
                      <span>Used by your live countdown</span>
                    </div>
                    <input
                      className="time-input"
                      type="time"
                      value={prefs.cutoff}
                      onChange={(e) =>
                        setPrefs({ ...prefs, cutoff: e.target.value })
                      }
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Carry-forward tasks</strong>
                      <span>Keep unfinished work visible</span>
                    </div>
                    <span className="setting-value">On</span>
                  </div>
                </section>
                <section className="panel settings-panel">
                  <div className="settings-title">
                    <Bell size={18} />
                    <div>
                      <h2>Reminders</h2>
                      <p>Stay aware of your plan.</p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>In-app reminders</strong>
                      <span>Show helpful task notifications</span>
                    </div>
                    <button
                      className={`toggle ${prefs.reminders ? "on" : ""}`}
                      onClick={() =>
                        setPrefs({ ...prefs, reminders: !prefs.reminders })
                      }
                      aria-label="Toggle reminders"
                    >
                      <i />
                    </button>
                  </div>
                  <p className="setting-note">
                    Scheduled task reminders and focus alerts use Windows
                    notifications in the installed app.
                  </p>
                </section>
                <section className="panel settings-panel">
                  <div className="settings-title">
                    <SlidersHorizontal size={18} />
                    <div>
                      <h2>Data & privacy</h2>
                      <p>Private cloud sync with an offline copy.</p>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Firebase sync</strong>
                      <span>
                        Tasks, settings, and focus state are stored under your
                        authenticated account.
                      </span>
                    </div>
                    <span className="setting-value">
                      {cloudReady ? "Connected" : cloudError ? "Sync paused" : "Connecting"}
                    </span>
                  </div>
                  {cloudError && <div className="setting-note" role="status">{cloudError}<button className="subtle-btn" type="button" onClick={() => setCloudAttempt(attempt => attempt + 1)}>Retry sync</button></div>}
                </section>
              </div>
            </div>
          )}
        </main>
        <aside className="right-rail">
          <div className="rail-heading">
            <span>YOUR DAY AT A GLANCE</span>
            <span>
              <Sparkles size={16} />
            </span>
          </div>
          <section className="rail-card focus-card">
            <div className="rail-card-title">
              <span className="rail-icon">
                <Focus size={17} />
              </span>
              <span>Focus session</span>
              <i className={`status-dot ${session?.running ? "active" : ""}`} />
            </div>
            {activeTask && session ? (
              <>
                <p className="focus-task-label">WORKING ON</p>
                <h3>{activeTask.title}</h3>
                <div className="focus-time">
                  <svg className="focus-orbit" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="90" className="orbit-base"/><circle cx="100" cy="100" r="90" className="orbit-progress" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, focusRemaining / session.duration * 100))} 100`}/></svg>
                  <span className="focus-caption">{session.running ? 'IN THE FLOW' : 'TAKE A BREATH'}</span>
                  {focusRemaining < 0 ? "+" : ""}
                  {clock(Math.abs(focusRemaining))}
                </div>
                <div className="focus-track">
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, ((session.duration - focusRemaining) / session.duration) * 100))}%`,
                    }}
                  />
                </div>
                <div className="focus-sub">
                  <span>{focusRemaining < 0 ? "Overtime" : "Remaining"}</span>
                  <span>
                    {durationLabel(Math.round(session.duration / 60))} planned
                  </span>
                </div>
                <div className="focus-buttons">
                  <button
                    className="focus-primary"
                    onClick={() =>
                      setSession(
                        session.running
                          ? {
                              ...session,
                              remaining: focusRemaining,
                              running: false,
                              endsAt: undefined,
                            }
                          : {
                              ...session,
                              running: true,
                              endsAt: Date.now() + focusRemaining * 1000,
                            },
                      )
                    }
                  >
                    {session.running ? (
                      <Pause size={15} fill="currentColor" />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                    {session.running ? "Pause" : "Resume"}
                  </button>
                  <button
                    className="focus-secondary"
                    onClick={() => {
                      complete(activeTask);
                      setSession(null);
                    }}
                  >
                    <Check size={15} />
                    Done
                  </button>
                  <button
                    className="icon-btn"
                    title="Stop session"
                    onClick={() => setSession(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="focus-idle">
                  <div className="idle-ring">
                    <Play size={19} fill="currentColor" />
                  </div>
                  <strong>Ready when you are.</strong>
                  <p>Start a task and give it your full attention.</p>
                </div>
                <button
                  className="focus-idle-button"
                  onClick={() => {
                    const t = open[0] ?? pending[0];
                    if (t) focus(t);
                    else setToast("Add a task to start focusing.");
                  }}
                >
                  <Play size={14} fill="currentColor" />
                  Start focusing
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </section>
          <section className="rail-card carry-card">
            <div className="rail-card-title">
              <span className="rail-icon amber-bg">
                <RotateCcw size={16} />
              </span>
              <span>Carried forward</span>
              <span className="rail-count">{pending.length}</span>
            </div>
            <p className="rail-description">Unfinished from earlier days</p>
            {pending.slice(0, 2).map((t) => (
              <div className="carry-item" key={t.id}>
                <i />
                <div>
                  <strong>{t.title}</strong>
                  <span>
                    {t.date === shifted(today, -1)
                      ? "Yesterday"
                      : `${Math.round((asDate(today).getTime() - asDate(t.date).getTime()) / 86400000)} days ago`}{" "}
                    · {durationLabel(t.duration)}
                  </span>
                </div>
                <button
                  onClick={() => moveToday(t)}
                  title="Move to today"
                  aria-label={`Move ${t.title} to today`}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            ))}
            {pending.length === 0 && (
              <p className="rail-description">
                Everything from previous days is complete.
              </p>
            )}
            <button className="rail-link" onClick={() => setPage("Pending")}>
              View all pending
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="rail-card insight-card">
            <div className="rail-card-title">
              <span className="rail-icon purple-bg">
                <Flame size={17} />
              </span>
              <span>Time insight</span>
            </div>
            <p>
              {workLeft * 60 > secondsLeft
                ? "Your plan needs more time than today has left."
                : "You have room to make meaningful progress today."}
            </p>
            <div className="insight-stats">
              <span>
                <b>{durationLabel(workLeft)}</b> planned work
              </span>
              <span>
                <b>{durationLabel(Math.floor(secondsLeft / 60))}</b> day left
              </span>
            </div>
            <button className="rail-link" onClick={() => setSuggestions(true)}>
              Review your plan
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="rail-footer">
            ✦ &nbsp; Every day is a fresh start.
          </div>
        </aside>
      </div>
      {activeTask && session && page !== "Today" && (
        <button className="mini-timer" onClick={() => setPage("Today")}>
          <Focus size={17} />
          <span>{activeTask.title}</span>
          <strong>{clock(Math.abs(focusRemaining))}</strong>
          <ArrowRight size={14} />
        </button>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {editor && (
        <TaskEditor
          key={editor === "new" ? "new" : editor.id}
          task={editor === "new" ? null : editor}
          today={today}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      {suggestions && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSuggestions(false);
          }}
        >
          <div className="suggestion-modal">
            <button
              className="icon-btn modal-close"
              onClick={() => setSuggestions(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <span className="modal-emblem">
              <Sparkles size={20} />
            </span>
            <div className="eyebrow">PLAN YOUR REMAINING TIME</div>
            <h2>Make the hours count.</h2>
            <p>
              You have {durationLabel(workLeft)} of unfinished work and{" "}
              {durationLabel(Math.floor(secondsLeft / 60))} left in your day.
              Here is a lighter timebox for each task.
            </p>
            <div className="suggestions">
              {[...open, ...pending]
                .filter((t) => t.duration > 0)
                .map((t) => (
                  <div key={t.id}>
                    <span>{t.title}</span>
                    <span>
                      {durationLabel(t.duration)} <ArrowRight size={13} />{" "}
                      <strong>
                        {durationLabel(
                          Math.max(
                            15,
                            Math.floor(
                              (t.duration *
                                Math.min(
                                  1,
                                  secondsLeft / Math.max(1, workLeft * 60),
                                )) /
                                15,
                            ) * 15,
                          ),
                        )}
                      </strong>
                    </span>
                  </div>
                ))}
            </div>
            <p className="suggestion-foot">
              Suggestions are a guide. Your task estimates stay unchanged.
            </p>
            <button
              className="primary-btn"
              onClick={() => setSuggestions(false)}
            >
              Back to my day
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskEditor({
  task,
  today,
  onClose,
  onSave,
}: {
  task: Task | null;
  today: string;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [project, setProject] = useState(task?.project ?? "");
  const [date, setDate] = useState(task?.date ?? today);
  const [time, setTime] = useState(task?.time ?? "");
  const [duration, setDuration] = useState(task?.duration ?? 45);
  const [recurring, setRecurring] = useState(task?.recurring ?? false);
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "Every day");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave({
      ...task,
      id: task?.id ?? globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      title: title.trim(),
      project: project.trim(),
      date,
      time,
      duration: Number.isFinite(duration)
        ? Math.min(1440, Math.max(0, duration))
        : 0,
      completed: task?.completed ?? false,
      recurring,
      recurrence: recurring ? recurrence : "",
      notes,
      color: task?.color ?? "violet",
      plannedFor: date === task?.date ? task?.plannedFor : undefined,
    });
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="task-editor" onSubmit={submit}>
        <div className="editor-head">
          <div>
            <div className="eyebrow">
              {task ? "EDIT YOUR PLAN" : "A NEW STEP FORWARD"}
            </div>
            <h2>
              {task ? "Edit task" : "Add a task"}
              <span>.</span>
            </h2>
            <p>Keep it simple. A title is all you need.</p>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={19} />
          </button>
        </div>
        <label className="field">
          <span>
            Task name <b>*</b>
          </span>
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to get done?"
          />
        </label>
        <label className="field">
          <span>
            Project <small>OPTIONAL</small>
          </span>
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="e.g. AWS Learning"
          />
        </label>
        <div className="field-pair">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Start time <small>OPTIONAL</small>
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <span>Estimated duration</span>
          <div className="duration-options">
            {[15, 30, 45, 60, 120].map((n) => (
              <button
                type="button"
                key={n}
                className={duration === n ? "selected" : ""}
                onClick={() => setDuration(n)}
              >
                {durationLabel(n)}
              </button>
            ))}
          </div>
          <div className="duration-custom">
            <input
              type="number"
              min="0"
              max="1440"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
            <span>minutes · 0 for no estimate</span>
          </div>
        </div>
        <div className="editor-toggle-row">
          <div>
            <strong>Repeat this task</strong>
            <span>Make it a regular part of your day</span>
          </div>
          <button
            type="button"
            className={`toggle ${recurring ? "on" : ""}`}
            onClick={() => setRecurring(!recurring)}
            aria-label="Toggle recurring task"
          >
            <i />
          </button>
        </div>
        {recurring && (
          <label className="field">
            <span>Repeats</span>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
            >
              <option>Every day</option>
              <option>Every weekday</option>
              <option>Every week</option>
              <option>Every month</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>
            Notes <small>OPTIONAL</small>
          </span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="A little context for later..."
          />
        </label>
        <div className="editor-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" type="submit">
            <Check size={16} />
            Save task
          </button>
        </div>
      </form>
    </div>
  );
}
export default App;
