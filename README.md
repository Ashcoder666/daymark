# Daymark for Windows

Daymark is a local personal planner built with Tauri 2, Rust, React, and TypeScript. Your tasks and settings stay on this PC.

## Run the Windows app

Open PowerShell in this folder, then run:

```powershell
npm ci
npm run desktop:dev
```

This requires Node.js, the Rust MSVC toolchain, Microsoft C++ Build Tools, and WebView2. To build an installable Windows version:

```powershell
npm run desktop:build
```

The NSIS installer is written to `src-tauri\target\release\bundle\nsis`. The browser-only preview is available with `npm run dev`.

## What works

- Today dashboard with a live day cutoff, progress, daily plan, and carry-forward work.
- Add, edit, complete, reschedule, search, and focus on tasks. Ctrl+N opens task creation.
- Focus sessions use an end timestamp, so the clock catches up after the window is minimized or the computer sleeps. The session is restored when Daymark reopens.
- Daily, weekday, weekly, and monthly routines create independent task occurrences. Routines can be paused and resumed.
- Calendar, history, pending tasks, dark/white themes, and customizable day cutoff.
- Native Windows window controls and local app-data storage. Scheduled tasks and completed focus estimates can trigger Windows notifications in an installed app.

## Data and scope

The Windows app saves tasks, settings, and the active focus session in `daymark.json` in Tauri's app-data directory. Browser preview data stays in that browser's local storage and is separate from the installed app. Daymark starts with a clean plan; it does not insert sample tasks into the Windows app.

Daymark does not yet include cloud sync, backup import/export, startup launch, or a system tray. Notifications require the app process to be running; a session that ends while Daymark is closed is recognized when it reopens. On Windows, Tauri's notification plugin sends native notifications from installed apps.

## Checks

```powershell
npm test
npm run build
```
