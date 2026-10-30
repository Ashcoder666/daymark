# Daymark web and Windows

Both versions share src/, Firebase Authentication, and Firestore. Tauri-only window controls are hidden in browsers. Sign in with the same account on every device.

From this folder:

1. Run `npx firebase login` and sign into the Google account that owns daymark-49920.
2. Run `npm run web:deploy`.
3. Open https://daymark-49920.web.app on your phone or tablet.

Deployment builds dist/ automatically and uploads only Hosting files. It does not deploy database rules or change authentication settings. Firebase client configuration comes from .env.local; keep that file on this computer. No server process is needed after deployment.

Local browser preview: `npm run dev`. Windows build: `npm run desktop:build`.
