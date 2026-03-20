# RDF2Fabric App

This folder contains the shared React application that can be deployed as:
- **Web App** → Azure Static Web App (via `azd up`)
- **Desktop App** → Electron (Windows, macOS, Linux)

## Current Features (Mar 2026)

| Feature | Status |
|---------|--------|
| Entra ID Authentication | ✅ Working |
| Workspace Configuration | ✅ Settings page + localStorage |
| File Browser | ✅ OneLake DFS API integration |
| Decision Dashboard | ✅ 12 B-decisions with auto-resolve |
| Schema Level Selector | ✅ Manual (0-4) + scenario presets |
| Project Management | ✅ Create, rename, delete projects |
| Pipeline Execution | ✅ Server-side orchestrator + progress tracking |
| Config Export | ✅ Writes `pipeline_run.json` to OneLake |

## Folder Structure

```
app/
├── src/                  # React application source
│   ├── components/       # Reusable UI components
│   │   ├── TranslationPanel.tsx  # Pipeline execution UI
│   │   ├── Layout.tsx            # App shell
│   │   └── ...
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Route pages
│   │   ├── HomePage.tsx          # Project list
│   │   ├── ProjectPage.tsx       # Decision dashboard + execute
│   │   └── SettingsPage.tsx      # Workspace config
│   ├── services/         # Fabric API client, auth
│   │   ├── authService.ts        # MSAL wrapper
│   │   └── fabricService.ts      # OneLake + notebook execution
│   ├── stores/           # Zustand state management
│   └── App.tsx           # Main application component
│
├── electron/             # Electron main process
│   └── main.js           # Desktop app entry point
│
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Development

```bash
# Install dependencies
npm install

# Run web app in development mode
npm run dev

# Run desktop app in development mode
npm run electron:dev
```

## Building

```bash
# Build web app (output: dist/)
npm run build

# Build desktop installers (output: dist-electron/)
npm run electron:build
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@fluentui/react-components` | Microsoft Fluent UI components |
| `reactflow` | Interactive graph visualization |
| `@azure/msal-browser` | Entra ID authentication |
| `zustand` | Lightweight state management |
| `electron` | Desktop app wrapper |

## Authentication

- **Web App**: Uses MSAL.js with redirect flow (SSO)
- **Desktop App**: Uses MSAL.js with device code flow (works cross-tenant)

Both methods authenticate against the user's Entra ID tenant and acquire tokens for the Fabric REST API.
