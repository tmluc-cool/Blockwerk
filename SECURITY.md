# Security Policy

## Supported versions

Blockwerk is in early development. Security fixes are made on the `main` branch and shipped with the next release.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through GitHub:

1. Open the repository's **Security** tab.
2. Click **Report a vulnerability** and describe the problem, the affected version and how to reproduce it.

You will get an answer within a week. Once the problem is fixed, the report is published together with the fix and credits, if you want them.

## Security model in short

- Blockwerk runs locally and offline. It has no telemetry and no account.
- The network is only used by `pnpm assets:fetch` during development and by the optional AI assistant when the user has stored their own API key. The key is stored locally (encrypted with Electron's `safeStorage` in the desktop app) and never committed or sent anywhere else.
- The desktop app loads only its own files through the `blockwerk://` protocol, blocks navigation to other sites and uses a Content Security Policy without network access.
- Projects are plain files. Opening a project from someone else runs its block scripts only inside the play mode of the editor.
