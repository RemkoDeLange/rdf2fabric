# RDF2Fabric

A **generic tool** for translating RDF (Semantic Web) data into Microsoft Fabric Graph (Labeled Property Graph).

## What it does

RDF and Fabric Graph use fundamentally different graph paradigms that cannot be mapped 1:1. This tool guides users through the **12 modeling decisions** required to translate any RDF dataset into Fabric's property graph format.

- **Works with any RDF data**: DBpedia, schema.org, FIBO, custom ontologies
- **Interactive decision UI**: Graph visualization to preview RDF → LPG mapping
- **Automated processing**: Once decisions are made, translation runs automatically

## Installation Options

### Option A: Desktop App (Simplest)

1. Download installer from [GitHub Releases](../../releases):
   - Windows: `rdf2fabric-setup.exe`
   - macOS: `rdf2fabric.dmg`
   - Linux: `rdf2fabric.AppImage`
2. [Set up Fabric workspace](#set-up-fabric-workspace)
3. Run app, login with your Entra ID, configure workspace URL

### Option B: Web App (Azure)

1. Prerequisites: [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) + [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd)
2. Clone this repo and run:
   ```bash
   azd auth login
   azd up
   ```
3. [Set up Fabric workspace](#set-up-fabric-workspace)
4. Open browser to the deployed URL, configure workspace URL

### Set up Fabric Workspace

> **You choose the workspace.** The app does NOT auto-create workspaces.

1. Create a new workspace or use an existing one
2. Go to workspace **Settings** → **Git integration**
3. Connect to this GitHub repository (fork it first)
4. Fabric auto-imports notebooks and pipelines from `src/fabric/`
5. A lakehouse will be created automatically when notebooks run

## Project Structure

```
fabric_rdf_translation/
├── docs/                     # Documentation
│   ├── requirements.md       # Business & technical requirements
│   ├── architecture.md       # System design & decisions
│   └── data-sources.md       # Test data (NEN 2660-2)
│
├── src/
│   ├── fabric/               # Fabric backend (notebooks, pipelines)
│   └── app/                  # React frontend (web + desktop)
│
└── infra/                    # Azure deployment (bicep)
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| UI | React + Fluent UI + React Flow (graph viz) |
| Backend | Spark notebooks (Scala + Python), Apache Jena for RDF parsing |
| Storage | Delta Lake (Lakehouse) |
| Target | Fabric Ontology + Fabric Graph |
| Auth | Entra ID (SSO / device code) |

## Documentation

- [Requirements](docs/requirements.md) - Business & technical requirements
- [Architecture](docs/architecture.md) - System design and decisions
- [Data Sources](docs/data-sources.md) - Test data documentation

## Status

🟢 **Requirements Complete** - Ready for implementation
