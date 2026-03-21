# RDF2Fabric App

React application for guiding users through RDF → Fabric Graph translation decisions.

> **Current Focus:** Web app (local dev or Azure Static Web App). Desktop (Electron) packaging is deferred.

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
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Development

```bash
# Install dependencies
npm install

# Run web app in development mode
npm run dev
```

## Building

```bash
# Build web app (output: dist/)
npm run build
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@fluentui/react-components` | Microsoft Fluent UI components |
| `reactflow` | Interactive graph visualization |
| `@azure/msal-browser` | Entra ID authentication |
| `zustand` | Lightweight state management |

## Authentication

Uses MSAL.js with redirect flow (SSO) authenticating against the user's Entra ID tenant to acquire tokens for the Fabric REST API.
