# RDF2Fabric

A **proof of concept** exploring what it takes to import RDF (Semantic Web) data into Microsoft Fabric Real-Time Intelligence — specifically Fabric Ontology and Fabric Graph.

## Status (Mar 20, 2026)

✅ **Proof of Concept Complete** — Full pipeline working with 11/12 B-decisions implemented

| Component | Status |
|-----------|--------|
| RDF Parser (Jena) | ✅ Turtle, TriG, JSON-LD, RDF/XML, N-Triples, N-Quads |
| Schema Detection | ✅ 5 levels (Instance-only → SHACL) |
| Translation Pipeline | ✅ NB00-NB09 orchestrated execution |
| Decision Enforcement | ✅ 11/12 decisions read from config + enforced |
| Ontology API | ✅ Entity types, relationships, data bindings |
| Graph Materialization | ✅ 74 entities, 48 relationships, 372 edges |
| React App | ✅ Auth, workspace config, file browser, decision dashboard |
| Pipeline Execution | ✅ Server-side orchestrator with progress tracking |

## What this PoC explores

RDF and Fabric Graph use fundamentally different graph paradigms that cannot be mapped 1:1. This PoC investigates the **translation challenges**, the **12 modeling decisions** involved, and the current capabilities and limitations of Fabric's Ontology and Graph APIs.

- **RDF → LPG translation**: Parsing RDF, discovering schema, mapping classes to entity types, properties to attributes, and object properties to relationships
- **Fabric Ontology API integration**: Creating ontology definitions, uploading data bindings, handling LRO patterns
- **Fabric Graph materialization**: Building GraphModel definitions, triggering RefreshGraph, understanding the end-to-end pipeline
- **Decision enforcement**: App captures user decisions, notebooks read and act on them
- **NEN 2660-2 as test data**: Dutch built environment standard used to exercise the full translation pipeline

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

- [Project Status](docs/project-status.md) - Current state and sprint progress
- [Requirements](docs/requirements.md) - Business & technical requirements
- [Architecture](docs/architecture.md) - System design and decisions
- [Data Sources](docs/data-sources.md) - Test data documentation
- [Backlog](docs/backlog.md) - Feature backlog and implementation status

## Key Findings

| Finding | Implication |
|---------|-------------|
| Fabric Graph uses GQL (ISO), not Gremlin | Query syntax differs from Neo4j/Neptune |
| Schema ≠ Instance predicates | `owl:hasFunctionalPart` vs actual `hasPart` |
| Type-specific relationships | `hasPart` becomes `haspart_1`, `haspart_2` per node type pair |
| RefreshGraph is async + expensive | 30+ minute jobs, must poll for completion |
| ConcurrentOperation cancels jobs | Only one RefreshGraph at a time |

## Next Phase

**F2.4 External Ontology Dereferencing** — Enable "follow your nose" Linked Data pattern by automatically fetching schema from external namespace URIs.
